// Normalizes provider chat output for the org AI client and generates persisted thread metadata.
import { z } from 'zod';

import { getAiRuntimeConfig, getAiRuntimeSummary } from '@/lib/ai/config';
import { streamCloudAiChatStub } from '@/lib/ai/providers/cloudStub';
import {
  completeLocalOllamaChat,
  streamLocalOllamaChat,
} from '@/lib/ai/providers/localOllama';
import type {
  AiChatCompletionResult,
  AiChatMessage,
  AiChatStreamResponse,
  AiProviderCompletionResult,
  AiProviderStreamResult,
  AiStreamEvent,
} from '@/lib/types/aiTypes';
import type { OrganizationAiGeneratedThreadMetadata } from '@/lib/types/organizationAiChatTypes';
import { ApiError, ServiceUnavailableError } from '@/lib/utils/apiErrors';

type OpenAiCompatibleStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
};

const encoder = new TextEncoder();
const threadMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(220),
});

// Encode each event as a single NDJSON line so the browser can incrementally parse the stream.
function encodeAiStreamEvent(event: AiStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

// Translate Ollama's SSE-style chunks into NDJSON events and track accumulated assistant content.
function emitParsedSseLine({
  line,
  controller,
  sentDone,
  onDelta,
}: {
  line: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  sentDone: boolean;
  onDelta: (delta: string) => void;
}) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith(':') || !trimmedLine.startsWith('data:')) {
    return sentDone;
  }

  const payload = trimmedLine.slice('data:'.length).trim();

  if (!payload) {
    return sentDone;
  }

  if (payload === '[DONE]') {
    if (!sentDone) {
      controller.enqueue(encodeAiStreamEvent({ type: 'done' }));
    }

    return true;
  }

  const parsedChunk = JSON.parse(payload) as OpenAiCompatibleStreamChunk;
  const choice = parsedChunk.choices?.[0];
  const delta = choice?.delta?.content;

  if (typeof delta === 'string' && delta.length > 0) {
    onDelta(delta);
    controller.enqueue(encodeAiStreamEvent({ type: 'delta', delta }));
  }

  if (choice?.finish_reason && !sentDone) {
    controller.enqueue(encodeAiStreamEvent({ type: 'done' }));
    return true;
  }

  return sentDone;
}

// Hold partial provider lines until a full SSE payload is available.
function drainProviderBuffer({
  buffer,
  controller,
  sentDone,
  onDelta,
  flush = false,
}: {
  buffer: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  sentDone: boolean;
  onDelta: (delta: string) => void;
  flush?: boolean;
}) {
  const lines = buffer.split('\n');
  const pendingLine = flush ? lines.pop() ?? '' : '';
  const pendingBuffer = flush ? '' : lines.pop() ?? '';
  let nextSentDone = sentDone;

  for (const line of lines) {
    nextSentDone = emitParsedSseLine({
      line,
      controller,
      sentDone: nextSentDone,
      onDelta,
    });
  }

  if (flush && pendingLine.trim()) {
    nextSentDone = emitParsedSseLine({
      line: pendingLine,
      controller,
      sentDone: nextSentDone,
      onDelta,
    });
  }

  return {
    buffer: pendingBuffer,
    sentDone: nextSentDone,
  };
}

// Pick the active provider once so the stream lifecycle stays consistent for the full request.
async function resolveProviderStream(
  messages: AiChatMessage[]
): Promise<AiProviderStreamResult> {
  const runtime = getAiRuntimeConfig();

  if (runtime.useLocalProvider) {
    return streamLocalOllamaChat({
      baseUrl: runtime.localBaseUrl,
      model: runtime.model,
      messages,
    });
  }

  return streamCloudAiChatStub();
}

// Keep short metadata prompts on the same runtime path as the main chat stream.
async function resolveProviderCompletion(
  messages: AiChatMessage[]
): Promise<AiProviderCompletionResult> {
  const runtime = getAiRuntimeConfig();

  if (runtime.useLocalProvider) {
    return completeLocalOllamaChat({
      baseUrl: runtime.localBaseUrl,
      model: runtime.model,
      messages,
    });
  }

  throw new ServiceUnavailableError(
    'AI metadata generation is not available in this environment'
  );
}

// Some local models wrap JSON in prose, so extract the first object block before parsing.
function parseGeneratedJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const firstBraceIndex = content.indexOf('{');
    const lastBraceIndex = content.lastIndexOf('}');

    if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
      throw new ApiError(502, 'Failed to generate chat thread metadata');
    }

    return JSON.parse(content.slice(firstBraceIndex, lastBraceIndex + 1)) as unknown;
  }
}

// Generate the thread sidebar metadata from the initial user prompt before the first thread write.
export async function generateAiThreadMetadata({
  conversationStarter,
}: {
  conversationStarter: string;
}): Promise<OrganizationAiGeneratedThreadMetadata> {
  const providerResponse = await resolveProviderCompletion([
    {
      role: 'system',
      content:
        'Return strict JSON with exactly two string keys: "title" and "summary". The title must be 3 to 6 words, sentence case, and never include markdown. The summary must be a single short sentence under 120 characters, plain text only.',
    },
    {
      role: 'user',
      content: `Conversation starter:\n${conversationStarter.trim()}`,
    },
  ]);

  const parsedMetadata = threadMetadataSchema.safeParse(
    parseGeneratedJson(providerResponse.content)
  );

  if (!parsedMetadata.success) {
    throw new ApiError(502, 'Failed to generate chat thread metadata');
  }

  return parsedMetadata.data;
}

// Bridge provider output into a stable stream contract and a completion result for persistence.
export async function createAiChatEventStream({
  messages,
}: {
  messages: AiChatMessage[];
}): Promise<AiChatStreamResponse> {
  const runtime = getAiRuntimeSummary();
  const providerStream = await resolveProviderStream(messages);
  const providerReader = providerStream.stream.getReader();
  let assistantContent = '';
  let resolveCompletion: (result: AiChatCompletionResult) => void = () => {};
  const completion = new Promise<AiChatCompletionResult>((resolve) => {
    resolveCompletion = resolve;
  });
  let completionSettled = false;

  const finalizeCompletion = (result: AiChatCompletionResult) => {
    if (completionSettled) {
      return;
    }

    completionSettled = true;
    resolveCompletion(result);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = '';
      let sentDone = false;

      controller.enqueue(
        encodeAiStreamEvent({
          type: 'start',
          provider: providerStream.provider,
          model: providerStream.model,
        })
      );

      try {
        while (true) {
          const { done, value } = await providerReader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const drainedBuffer = drainProviderBuffer({
            buffer,
            controller,
            sentDone,
            onDelta: (delta) => {
              assistantContent += delta;
            },
          });

          buffer = drainedBuffer.buffer;
          sentDone = drainedBuffer.sentDone;
        }

        buffer += decoder.decode();
        const drainedBuffer = drainProviderBuffer({
          buffer,
          controller,
          sentDone,
          onDelta: (delta) => {
            assistantContent += delta;
          },
          flush: true,
        });

        sentDone = drainedBuffer.sentDone;

        if (!sentDone) {
          controller.enqueue(encodeAiStreamEvent({ type: 'done' }));
        }

        finalizeCompletion({
          provider: providerStream.provider,
          model: providerStream.model,
          content: assistantContent,
          status: 'completed',
        });
        controller.close();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to stream the AI response';

        finalizeCompletion({
          provider: providerStream.provider,
          model: providerStream.model,
          content: assistantContent.trim() ? assistantContent : errorMessage,
          status: 'failed',
          error: errorMessage,
        });
        controller.enqueue(
          encodeAiStreamEvent({
            type: 'error',
            error: errorMessage,
          })
        );
        controller.close();
      } finally {
        providerReader.releaseLock();
      }
    },
    async cancel(reason) {
      finalizeCompletion({
        provider: providerStream.provider,
        model: providerStream.model,
        content: assistantContent.trim()
          ? assistantContent
          : 'Generation stopped before completion.',
        status: 'failed',
        error: 'Generation stopped before completion.',
      });
      await providerReader.cancel(reason);
    },
  });

  return {
    runtime,
    stream,
    completion,
  };
}
