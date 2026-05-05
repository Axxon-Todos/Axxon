// Verifies local Ollama requests recover from stale Docker hostnames by retrying host-accessible aliases.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeLocalOllamaChat } from '@/lib/ai/providers/localOllama';
import { getLocalOllamaRuntimeStatus } from '@/lib/ai/localOllamaRuntime';

function createFetchFailure(code: string, host: string) {
  return Object.assign(new TypeError('fetch failed'), {
    cause: {
      code,
      hostname: host,
      syscall: 'getaddrinfo',
    },
  });
}

describe('local Ollama connectivity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('falls back from the legacy Docker hostname to a reachable host alias for chat completions', async () => {
    const mockedFetch = vi
      .fn()
      .mockRejectedValueOnce(createFetchFailure('ENOTFOUND', 'ollama'))
      .mockRejectedValueOnce(
        createFetchFailure('ENOTFOUND', 'host.docker.internal')
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Recovered response',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

    vi.stubGlobal('fetch', mockedFetch);

    const result = await completeLocalOllamaChat({
      baseUrl: 'http://ollama:11434',
      model: 'qwen2.5-coder:14b',
      messages: [
        {
          role: 'user',
          content: 'Reply with ok.',
        },
      ],
    });

    expect(result).toEqual({
      provider: 'local-ollama',
      model: 'qwen2.5-coder:14b',
      content: 'Recovered response',
    });
    expect(mockedFetch.mock.calls.map(([url]) => String(url))).toEqual([
      'http://ollama:11434/v1/chat/completions',
      'http://host.docker.internal:11434/v1/chat/completions',
      'http://127.0.0.1:11434/v1/chat/completions',
    ]);
  });

  it('reuses the same fallback chain when checking planning runtime readiness', async () => {
    const mockedFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (
        url.startsWith('http://ollama:11434') ||
        url.startsWith('http://host.docker.internal:11434')
      ) {
        throw createFetchFailure('ENOTFOUND', new URL(url).hostname);
      }

      if (url === 'http://127.0.0.1:11434/api/tags') {
        return new Response(
          JSON.stringify({
            models: [{ name: 'qwen2.5-coder:14b' }],
          }),
          { status: 200 }
        );
      }

      if (url === 'http://127.0.0.1:11434/api/ps') {
        return new Response(
          JSON.stringify({
            models: [
              {
                name: 'qwen2.5-coder:14b',
                processor: '100% GPU',
              },
            ],
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    vi.stubGlobal('fetch', mockedFetch);

    const status = await getLocalOllamaRuntimeStatus({
      baseUrl: 'http://ollama:11434',
      model: 'qwen2.5-coder:14b',
    });

    expect(status).toMatchObject({
      modelAvailable: true,
      accelerationState: 'gpu',
      planningReady: true,
    });
    expect(mockedFetch.mock.calls.map(([url]) => String(url))).toEqual([
      'http://ollama:11434/api/tags',
      'http://ollama:11434/api/ps',
      'http://host.docker.internal:11434/api/tags',
      'http://host.docker.internal:11434/api/ps',
      'http://127.0.0.1:11434/api/tags',
      'http://127.0.0.1:11434/api/ps',
    ]);
  });

  it('treats VRAM-backed Ollama models as GPU-backed even when processor labels are missing', async () => {
    const mockedFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url === 'http://127.0.0.1:11434/api/tags') {
        return new Response(
          JSON.stringify({
            models: [{ name: 'qwen2.5-coder:14b' }],
          }),
          { status: 200 }
        );
      }

      if (url === 'http://127.0.0.1:11434/api/ps') {
        return new Response(
          JSON.stringify({
            models: [
              {
                name: 'qwen2.5-coder:14b',
                size: 10_310_086_656,
                size_vram: 9_288_847_360,
              },
            ],
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    vi.stubGlobal('fetch', mockedFetch);

    const status = await getLocalOllamaRuntimeStatus({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5-coder:14b',
    });

    expect(status).toMatchObject({
      modelAvailable: true,
      accelerationState: 'mixed',
      planningReady: true,
    });
  });
});
