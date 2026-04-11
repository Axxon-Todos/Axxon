// Resolves the active AI provider and runtime defaults from server environment variables.
import type { AiRuntimeConfig, AiRuntimeSummary } from '@/lib/types/aiTypes';

const DEFAULT_LOCAL_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_LOCAL_DOCKER_BASE_URL = 'http://ollama:11434';
const DEFAULT_LOCAL_HOST_BASE_URL = 'http://127.0.0.1:11434';
const CLOUD_PENDING_MODEL = 'cloud-pending';

// Prefer the dedicated deployment-stage flag so NODE_ENV stays aligned with Next.js expectations.
function normalizeStage(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue) {
    return normalizedValue;
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// Default to the Compose service name in Docker and localhost for host-based development.
function resolveLocalBaseUrl() {
  const configuredBaseUrl = process.env.AI_LOCAL_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return process.env.AXXON_ENV_MODE === 'docker'
    ? DEFAULT_LOCAL_DOCKER_BASE_URL
    : DEFAULT_LOCAL_HOST_BASE_URL;
}

// Centralize provider selection so routes and UI read the same runtime decision.
export function getAiRuntimeConfig(): AiRuntimeConfig {
  const stage = normalizeStage(process.env.AXXON_DEPLOY_STAGE);
  const useLocalProvider = stage === 'development' || stage === 'staging';
  const localModel = process.env.AI_LOCAL_MODEL?.trim() || DEFAULT_LOCAL_MODEL;

  return {
    stage,
    provider: useLocalProvider ? 'local-ollama' : 'cloud-stub',
    localBaseUrl: resolveLocalBaseUrl(),
    model: useLocalProvider ? localModel : CLOUD_PENDING_MODEL,
    useLocalProvider,
  };
}

// Expose a UI-friendly summary without leaking the full server-side config object.
export function getAiRuntimeSummary(): AiRuntimeSummary {
  const runtime = getAiRuntimeConfig();

  return {
    stage: runtime.stage,
    provider: runtime.provider,
    providerLabel:
      runtime.provider === 'local-ollama' ? 'Local Ollama' : 'Cloud provider',
    model: runtime.model,
    available: runtime.useLocalProvider,
    statusLabel: runtime.useLocalProvider ? 'Configured' : 'Cloud setup required',
  };
}
