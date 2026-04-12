// Streams or completes chat prompts through the local Ollama OpenAI-compatible endpoint.
import type {
  AiChatMessage,
  AiProviderCompletionResult,
  AiProviderStreamResult,
} from '@/lib/types/aiTypes';
import { ApiError } from '@/lib/utils/apiErrors';

type OpenAiCompatibleErrorResponse = {
  error?: {
    message?: string;
  } | string;
};

type OpenAiCompatibleCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

// Strip trailing slashes so endpoint joins do not accidentally create double separators.
function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

// Fall back gracefully when Ollama returns a non-JSON error body.
async function readProviderError(response: Response) {
  try {
    const data = (await response.json()) as OpenAiCompatibleErrorResponse;

    if (typeof data.error === 'string') {
      return data.error;
    }

    if (data.error?.message) {
      return data.error.message;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to the response status text.
  }

  return response.statusText || 'Unknown Ollama error';
}

// Send the chat transcript to Ollama's OpenAI-compatible endpoint and return the raw stream.
export async function streamLocalOllamaChat({
  baseUrl,
  model,
  messages,
}: {
  baseUrl: string;
  model: string;
  messages: AiChatMessage[];
}): Promise<AiProviderStreamResult> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorMessage = await readProviderError(response);
    throw new ApiError(502, `Local AI request failed: ${errorMessage}`);
  }

  if (!response.body) {
    throw new ApiError(502, 'Local AI did not return a response stream');
  }

  return {
    provider: 'local-ollama',
    model,
    stream: response.body,
  };
}

// Send a non-streaming chat completion to Ollama for short metadata-generation prompts.
export async function completeLocalOllamaChat({
  baseUrl,
  model,
  messages,
}: {
  baseUrl: string;
  model: string;
  messages: AiChatMessage[];
}): Promise<AiProviderCompletionResult> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/chat/completions`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorMessage = await readProviderError(response);
    throw new ApiError(502, `Local AI request failed: ${errorMessage}`);
  }

  const data = (await response.json()) as OpenAiCompatibleCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new ApiError(502, 'Local AI did not return completion content');
  }

  return {
    provider: 'local-ollama',
    model,
    content,
  };
}
