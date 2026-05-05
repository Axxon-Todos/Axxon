// Sends chat requests to external OpenAI-compatible providers used outside local Ollama environments.
import type {
  AiChatMessage,
  AiProviderCompletionResult,
  AiProviderId,
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

// Normalize provider error bodies so upstream callers can return stable 502s.
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

  return response.statusText || 'Unknown AI provider error';
}

// Trim trailing slashes once so request paths stay stable across env formats.
function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

// Build the shared OpenAI-compatible request headers, including bearer auth when configured.
function buildRequestHeaders(apiKey?: string | null) {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

// Stream a chat completion from an external OpenAI-compatible runtime.
export async function streamOpenAiCompatibleChat({
  apiKey,
  baseUrl,
  model,
  messages,
  provider,
}: {
  apiKey?: string | null;
  baseUrl: string;
  model: string;
  messages: AiChatMessage[];
  provider: AiProviderId;
}): Promise<AiProviderStreamResult> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: buildRequestHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    }
  ).catch((error: unknown) => {
    throw new ApiError(
      502,
      error instanceof Error
        ? `External AI request failed: ${error.message}`
        : 'External AI request failed'
    );
  });

  if (!response.ok) {
    const errorMessage = await readProviderError(response);
    throw new ApiError(502, `External AI request failed: ${errorMessage}`);
  }

  if (!response.body) {
    throw new ApiError(502, 'External AI did not return a response stream');
  }

  return {
    provider,
    model,
    stream: response.body,
  };
}

// Request a non-streaming completion from an external OpenAI-compatible runtime.
export async function completeOpenAiCompatibleChat({
  apiKey,
  baseUrl,
  model,
  messages,
  provider,
}: {
  apiKey?: string | null;
  baseUrl: string;
  model: string;
  messages: AiChatMessage[];
  provider: AiProviderId;
}): Promise<AiProviderCompletionResult> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: buildRequestHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    }
  ).catch((error: unknown) => {
    throw new ApiError(
      502,
      error instanceof Error
        ? `External AI request failed: ${error.message}`
        : 'External AI request failed'
    );
  });

  if (!response.ok) {
    const errorMessage = await readProviderError(response);
    throw new ApiError(502, `External AI request failed: ${errorMessage}`);
  }

  const data = (await response.json()) as OpenAiCompatibleCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new ApiError(502, 'External AI did not return completion content');
  }

  return {
    provider,
    model,
    content,
  };
}
