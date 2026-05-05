// Describes the org AI MVP request shapes, runtime metadata, and stream event contracts.
export type AiChatRole = 'system' | 'user' | 'assistant';

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

// The provider id is surfaced to the UI so the current runtime mode is visible during beta testing.
export type AiProviderId = 'local-ollama' | 'openai-compatible' | 'cloud-stub';
export type AiRuntimeAccelerationState =
  | 'gpu'
  | 'mixed'
  | 'cpu'
  | 'idle'
  | 'unknown';

export type AiRuntimeConfig = {
  stage: string;
  provider: AiProviderId;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  available: boolean;
  useLocalProvider: boolean;
};

export type AiRuntimeSummary = {
  stage: string;
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  available: boolean;
  statusLabel: string;
  accelerationState?: AiRuntimeAccelerationState;
  planningReady?: boolean;
  planningStatusLabel?: string;
};

export type AiProviderStreamResult = {
  provider: AiProviderId;
  model: string;
  stream: ReadableStream<Uint8Array>;
};

export type AiProviderCompletionResult = {
  provider: AiProviderId;
  model: string;
  content: string;
};

export type AiChatCompletionResult = {
  provider: AiProviderId;
  model: string;
  content: string;
  status: 'completed' | 'failed';
  error?: string;
};

export type AiChatStreamResponse = {
  runtime: AiRuntimeSummary;
  stream: ReadableStream<Uint8Array>;
  completion: Promise<AiChatCompletionResult>;
};

// NDJSON events keep the client decoupled from provider-specific response formats.
export type AiStreamEvent =
  | {
      type: 'start';
      provider: AiProviderId;
      model: string;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
    }
  | {
      type: 'error';
      error: string;
    };
