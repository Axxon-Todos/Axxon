// Normalizes provider-specific chat streams into NDJSON events for the org AI MVP client.
import { getAiRuntimeConfig, getAiRuntimeSummary } from '@/lib/ai/config';
import { streamCloudAiChatStub } from '@/lib/ai/providers/cloudStub';
import { streamLocalOllamaChat } from '@/lib/ai/providers/localOllama';
import type {
  AiChatMessage,
  AiChatStreamResponse,
  AiProviderStreamResult,
  AiStreamEvent,
} from '@/lib/types/aiTypes';

type OpenAiCompatibleStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
};

const encoder = new TextEncoder();

// Encode each event as a single NDJSON line so the browser can incrementally parse the stream.
function encodeAiStreamEvent(event: AiStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

// Translate Ollama's SSE-style OpenAI-compatible chunks into the app's NDJSON event format.
function emitParsedSseLine({
  line,
  controller,
  sentDone,
}: {
  line: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  sentDone: boolean;
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
  flush = false,
}: {
  buffer: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  sentDone: boolean;
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
    });
  }

  if (flush && pendingLine.trim()) {
    nextSentDone = emitParsedSseLine({
      line: pendingLine,
      controller,
      sentDone: nextSentDone,
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

// Bridge provider output into a stable stream contract that the org AI page can render incrementally.
export async function createAiChatEventStream({
  messages,
}: {
  messages: AiChatMessage[];
}): Promise<AiChatStreamResponse> {
  const runtime = getAiRuntimeSummary();
  const providerStream = await resolveProviderStream(messages);
  const providerReader = providerStream.stream.getReader();

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
          });

          buffer = drainedBuffer.buffer;
          sentDone = drainedBuffer.sentDone;
        }

        buffer += decoder.decode();
        const drainedBuffer = drainProviderBuffer({
          buffer,
          controller,
          sentDone,
          flush: true,
        });

        sentDone = drainedBuffer.sentDone;

        if (!sentDone) {
          controller.enqueue(encodeAiStreamEvent({ type: 'done' }));
        }

        controller.close();
      } catch (error) {
        controller.enqueue(
          encodeAiStreamEvent({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Failed to stream the AI response',
          })
        );
        controller.close();
      } finally {
        providerReader.releaseLock();
      }
    },
    async cancel(reason) {
      await providerReader.cancel(reason);
    },
  });

  return {
    runtime,
    stream,
  };
}
