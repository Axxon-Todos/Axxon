// Verifies AI runtime selection, completion metadata generation, and provider stream normalization.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ServiceUnavailableError } from '@/lib/utils/apiErrors';

const {
  mockedStreamLocalOllamaChat,
  mockedCompleteLocalOllamaChat,
  mockedStreamOpenAiCompatibleChat,
  mockedCompleteOpenAiCompatibleChat,
  mockedStreamCloudAiChatStub,
} = vi.hoisted(() => ({
  mockedStreamLocalOllamaChat: vi.fn(),
  mockedCompleteLocalOllamaChat: vi.fn(),
  mockedStreamOpenAiCompatibleChat: vi.fn(),
  mockedCompleteOpenAiCompatibleChat: vi.fn(),
  mockedStreamCloudAiChatStub: vi.fn(),
}));

vi.mock('@/lib/ai/providers/localOllama', () => ({
  streamLocalOllamaChat: mockedStreamLocalOllamaChat,
  completeLocalOllamaChat: mockedCompleteLocalOllamaChat,
}));

vi.mock('@/lib/ai/providers/openAiCompatible', () => ({
  streamOpenAiCompatibleChat: mockedStreamOpenAiCompatibleChat,
  completeOpenAiCompatibleChat: mockedCompleteOpenAiCompatibleChat,
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

  it('uses the local Ollama provider for development, normalizes SSE chunks, and resolves stream completion', async () => {
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
    await expect(response.completion).resolves.toEqual({
      provider: 'local-ollama',
      model: 'qwen2.5-coder:14b',
      content: 'Hello world',
      status: 'completed',
    });
  });

  it('generates thread metadata from a short non-stream completion prompt', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    mockedCompleteLocalOllamaChat.mockResolvedValue({
      provider: 'local-ollama',
      model: 'qwen2.5-coder:14b',
      content:
        'Here is the metadata: {"title":"Sprint planning chat","summary":"Plan the next sprint."}',
    });

    const { generateAiThreadMetadata } = await import('@/lib/ai/service');
    const metadata = await generateAiThreadMetadata({
      conversationStarter: 'Plan the next sprint',
    });

    expect(mockedCompleteLocalOllamaChat).toHaveBeenCalledWith({
      baseUrl: 'http://ollama:11434',
      model: 'qwen2.5-coder:14b',
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: 'Conversation starter:\nPlan the next sprint',
        }),
      ]),
    });
    expect(metadata).toEqual({
      title: 'Sprint planning chat',
      summary: 'Plan the next sprint.',
    });
  });

  it('retries one malformed structured JSON response before failing the planner stage', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    mockedCompleteLocalOllamaChat
      .mockResolvedValueOnce({
        provider: 'local-ollama',
        model: 'qwen2.5-coder:14b',
        content: 'I think the answer is probably scope-first.',
      })
      .mockResolvedValueOnce({
        provider: 'local-ollama',
        model: 'qwen2.5-coder:14b',
        content: '{"status":"ok"}',
      });

    const { completeAiStructuredJson } = await import('@/lib/ai/service');
    const result = await completeAiStructuredJson({
      messages: [
        {
          role: 'user',
          content: 'Return strict JSON',
        },
      ],
      schema: z.object({
        status: z.literal('ok'),
      }),
      failureMessage: 'Failed to parse structured JSON',
    });

    expect(result).toEqual({ status: 'ok' });
    expect(mockedCompleteLocalOllamaChat).toHaveBeenCalledTimes(2);
  });

  it('surfaces structured JSON validation diagnostics after the retry budget is exhausted', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    mockedCompleteLocalOllamaChat
      .mockResolvedValueOnce({
        provider: 'local-ollama',
        model: 'qwen2.5-coder:14b',
        content: '{"status":"almost"}',
      })
      .mockResolvedValueOnce({
        provider: 'local-ollama',
        model: 'qwen2.5-coder:14b',
        content: '{"status":"still-wrong"}',
      });

    const { completeAiStructuredJson } = await import('@/lib/ai/service');

    await expect(
      completeAiStructuredJson({
        messages: [
          {
            role: 'user',
            content: 'Return strict JSON',
          },
        ],
        schema: z.object({
          status: z.literal('ok'),
        }),
        failureMessage: 'Failed to parse structured JSON',
      })
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'Failed to parse structured JSON',
        failureCode: 'schema_validation_failed',
        responseExcerpt: '{"status":"still-wrong"}',
        validationIssues: expect.arrayContaining(['status: Invalid literal value, expected "ok"']),
      })
    );
  });

  it('fails fast when the local runtime returns an interactive shell hint instead of model JSON', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'development');
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://ollama:11434');
    vi.stubEnv('AI_LOCAL_MODEL', 'qwen2.5-coder:14b');

    mockedCompleteLocalOllamaChat.mockResolvedValue({
      provider: 'local-ollama',
      model: 'qwen2.5-coder:14b',
      content: '› Use /skills to list available skills',
    });

    const { completeAiStructuredJson } = await import('@/lib/ai/service');

    await expect(
      completeAiStructuredJson({
        messages: [
          {
            role: 'user',
            content: 'Return strict JSON',
          },
        ],
        schema: z.object({
          status: z.literal('ok'),
        }),
        failureMessage: 'Failed to parse structured JSON',
      })
    ).rejects.toEqual(
      expect.objectContaining({
        message:
          'Local AI returned an interactive shell hint instead of model output. Check AI_LOCAL_BASE_URL and AI_LOCAL_MODEL.',
        failureCode: 'json_parse_failed',
        responseExcerpt: '› Use /skills to list available skills',
      })
    );

    expect(mockedCompleteLocalOllamaChat).toHaveBeenCalledTimes(1);
  });

  it('repairs malformed bare-string arrays when extracting generated JSON', async () => {
    const { parseGeneratedJson } = await import('@/lib/ai/service');

    expect(
      parseGeneratedJson(`{
        "openQuestions": [AI model metrics are displayed in Grafana dashboard]
      }`)
    ).toEqual({
      openQuestions: ['AI model metrics are displayed in Grafana dashboard'],
    });
  });

  it('uses the external OpenAI-compatible provider in production when configured', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'production');
    vi.stubEnv('AI_CLOUD_BASE_URL', 'https://llm.example.com');
    vi.stubEnv('AI_CLOUD_MODEL', 'gpt-4o-mini');
    vi.stubEnv('AI_CLOUD_API_KEY', 'secret-token');

    mockedStreamOpenAiCompatibleChat.mockResolvedValue({
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"Hello from prod"}}]}\n\ndata: [DONE]\n\n'
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
          content: 'Hello',
        },
      ],
    });

    expect(mockedStreamOpenAiCompatibleChat).toHaveBeenCalledWith({
      apiKey: 'secret-token',
      baseUrl: 'https://llm.example.com',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
      provider: 'openai-compatible',
    });
    await expect(readEventStream(response.stream)).resolves.toEqual([
      {
        type: 'start',
        provider: 'openai-compatible',
        model: 'gpt-4o-mini',
      },
      {
        type: 'delta',
        delta: 'Hello from prod',
      },
      {
        type: 'done',
      },
    ]);
    await expect(response.completion).resolves.toEqual({
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      content: 'Hello from prod',
      status: 'completed',
    });
    expect(mockedStreamCloudAiChatStub).not.toHaveBeenCalled();
    expect(mockedStreamLocalOllamaChat).not.toHaveBeenCalled();
  });

  it('falls back to the cloud stub when production external AI is not configured', async () => {
    vi.stubEnv('AXXON_DEPLOY_STAGE', 'production');
    mockedStreamCloudAiChatStub.mockRejectedValue(
      new ServiceUnavailableError(
        'Cloud AI provider is not configured for this environment yet'
      )
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
    expect(mockedStreamOpenAiCompatibleChat).not.toHaveBeenCalled();
    expect(mockedStreamLocalOllamaChat).not.toHaveBeenCalled();
  });
});
