// Verifies AI runtime selection and provider stream normalization for the org AI MVP service layer.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceUnavailableError } from '@/lib/utils/apiErrors';

const {
  mockedStreamLocalOllamaChat,
  mockedStreamCloudAiChatStub,
} = vi.hoisted(() => ({
  mockedStreamLocalOllamaChat: vi.fn(),
  mockedStreamCloudAiChatStub: vi.fn(),
}));

vi.mock('@/lib/ai/providers/localOllama', () => ({
  streamLocalOllamaChat: mockedStreamLocalOllamaChat,
}));

vi.mock('@/lib/ai/providers/cloudStub', () => ({
  streamCloudAiChatStub: mockedStreamCloudAiChatStub,
}));

async function readEventStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('ai service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses the local Ollama provider for development and normalizes SSE chunks', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    mockedStreamLocalOllamaChat.mockResolvedValue({
      provider: 'local-ollama',
      model: 'qwen2.5-coder:14b',
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'
            )
          );
          controller.close();
        },
      }),
    });

    const { createAiChatEventStream } = await import('@/lib/ai/service');
    const response = await createAiChatEventStream({
      messages: [
        {
          role: 'user',
          content: 'Say hello',
        },
      ],
    });

    expect(mockedStreamLocalOllamaChat).toHaveBeenCalledWith({
      baseUrl: 'http://ollama:11434',
      model: 'qwen2.5-coder:14b',
      messages: [
        {
          role: 'user',
          content: 'Say hello',
        },
      ],
    });
    await expect(readEventStream(response.stream)).resolves.toEqual([
      {
        type: 'start',
        provider: 'local-ollama',
        model: 'qwen2.5-coder:14b',
      },
      {
        type: 'delta',
        delta: 'Hello',
      },
      {
        type: 'delta',
        delta: ' world',
      },
      {
        type: 'done',
      },
    ]);
  });

  it('switches to the cloud stub outside development-like stages', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'production');
    mockedStreamCloudAiChatStub.mockRejectedValue(
      new ServiceUnavailableError('Cloud AI provider is not configured for this environment yet')
    );

    const { createAiChatEventStream } = await import('@/lib/ai/service');

    await expect(
      createAiChatEventStream({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      })
    ).rejects.toThrow(
      'Cloud AI provider is not configured for this environment yet'
    );

    expect(mockedStreamCloudAiChatStub).toHaveBeenCalledOnce();
    expect(mockedStreamLocalOllamaChat).not.toHaveBeenCalled();
  });
});
