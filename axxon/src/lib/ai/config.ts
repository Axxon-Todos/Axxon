// Resolves the active AI provider and runtime defaults from server environment variables.
import { getLocalOllamaRuntimeStatus } from '@/lib/ai/localOllamaRuntime';
import type { AiRuntimeConfig, AiRuntimeSummary } from '@/lib/types/aiTypes';

const DEFAULT_LOCAL_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_LOCAL_DOCKER_BASE_URL = 'http://host.docker.internal:11434';
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

// Default to the host gateway in Docker and localhost for host-based development.
function resolveLocalBaseUrl() {
  const configuredBaseUrl = process.env.AI_LOCAL_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return process.env.AXXON_ENV_MODE === 'docker'
    ? DEFAULT_LOCAL_DOCKER_BASE_URL
    : DEFAULT_LOCAL_HOST_BASE_URL;
}

// Read the external runtime base URL once so production selection stays deterministic.
function resolveExternalBaseUrl() {
  const configuredBaseUrl = process.env.AI_CLOUD_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return null;
  }

  return configuredBaseUrl.replace(/\/+$/, '');
}

// Centralize provider selection so routes and UI read the same runtime decision.
export function getAiRuntimeConfig(): AiRuntimeConfig {
  const stage = normalizeStage(process.env.AXXON_DEPLOY_STAGE);
  const useLocalProvider = stage === 'development' || stage === 'staging';
  const localModel = process.env.AI_LOCAL_MODEL?.trim() || DEFAULT_LOCAL_MODEL;
  const externalBaseUrl = resolveExternalBaseUrl();
  const externalModel = process.env.AI_CLOUD_MODEL?.trim() || CLOUD_PENDING_MODEL;
  const externalApiKey = process.env.AI_CLOUD_API_KEY?.trim() || null;

  if (useLocalProvider) {
    return {
      stage,
      provider: 'local-ollama',
      baseUrl: resolveLocalBaseUrl(),
      apiKey: null,
      model: localModel,
      available: true,
      useLocalProvider: true,
    };
  }

  if (externalBaseUrl && externalModel !== CLOUD_PENDING_MODEL) {
    return {
      stage,
      provider: 'openai-compatible',
      baseUrl: externalBaseUrl,
      apiKey: externalApiKey,
      model: externalModel,
      available: true,
      useLocalProvider: false,
    };
  }

  return {
    stage,
    provider: 'cloud-stub',
    baseUrl: null,
    apiKey: null,
    model: CLOUD_PENDING_MODEL,
    available: false,
    useLocalProvider: false,
  };
}

// Expose a UI-friendly summary without leaking the full server-side config object.
export function getAiRuntimeSummary(): AiRuntimeSummary {
  const runtime = getAiRuntimeConfig();

  return {
    stage: runtime.stage,
    provider: runtime.provider,
    providerLabel:
      runtime.provider === 'local-ollama'
        ? 'Local Ollama'
        : runtime.provider === 'openai-compatible'
          ? 'External AI'
          : 'Cloud provider',
    model: runtime.model,
    available: runtime.available,
    statusLabel: runtime.available ? 'Configured' : 'External AI not configured',
  };
}

// Adds local-runtime readiness details for the AI workspace without changing the provider contract used by chat routes.
export async function getAiWorkspaceRuntimeSummary(): Promise<AiRuntimeSummary> {
  const runtimeConfig = getAiRuntimeConfig();
  const runtimeSummary = getAiRuntimeSummary();

  if (runtimeConfig.provider === 'openai-compatible') {
    return {
      ...runtimeSummary,
      accelerationState: 'unknown',
      planningReady: true,
      planningStatusLabel: 'Planning is available through the external AI provider.',
    };
  }

  if (!runtimeConfig.useLocalProvider) {
    return {
      ...runtimeSummary,
      accelerationState: 'unknown',
      planningReady: false,
      planningStatusLabel: 'Planning needs a configured external AI provider.',
    };
  }

  const runtimeStatus = await getLocalOllamaRuntimeStatus({
    baseUrl: runtimeConfig.baseUrl ?? resolveLocalBaseUrl(),
    model: runtimeConfig.model,
  });

  return {
    ...runtimeSummary,
    accelerationState: runtimeStatus.accelerationState,
    planningReady: runtimeStatus.planningReady,
    planningStatusLabel: runtimeStatus.planningStatusLabel,
  };
}
