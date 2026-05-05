// Inspects local Ollama model state so planning can require GPU-backed execution instead of silently falling back to CPU.
import {
  buildOllamaConnectionFailureMessage,
  fetchOllamaWithFallback,
} from '@/lib/ai/ollamaConnection';
import type { AiRuntimeAccelerationState } from '@/lib/types/aiTypes';
import { ServiceUnavailableError } from '@/lib/utils/apiErrors';

type OllamaTaggedModel = {
  model?: string;
  name?: string;
};

type OllamaListResponse = {
  models?: OllamaTaggedModel[];
};

type OllamaProcessModel = OllamaTaggedModel & {
  processor?: string;
  size?: number;
  size_vram?: number;
};

type OllamaPsResponse = {
  models?: OllamaProcessModel[];
};

export type LocalOllamaRuntimeStatus = {
  accelerationState: AiRuntimeAccelerationState;
  modelAvailable: boolean;
  planningReady: boolean;
  planningStatusLabel: string;
  processorLabel: string | null;
};

const STATUS_TIMEOUT_MS = 2_000;
const WARMUP_TIMEOUT_MS = 15_000;

function createTimeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

function normalizeModelName(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function withLatestAlias(value: string) {
  return value.endsWith(':latest') ? value : `${value}:latest`;
}

function modelMatches(candidate?: string | null, configuredModel?: string | null) {
  const normalizedCandidate = normalizeModelName(candidate);
  const normalizedConfigured = normalizeModelName(configuredModel);

  if (!normalizedCandidate || !normalizedConfigured) {
    return false;
  }

  return (
    normalizedCandidate === normalizedConfigured ||
    normalizedCandidate === withLatestAlias(normalizedConfigured) ||
    withLatestAlias(normalizedCandidate) === normalizedConfigured
  );
}

function resolveAccelerationState({
  processorLabel,
  totalSizeBytes,
  vramSizeBytes,
}: {
  processorLabel?: string | null;
  totalSizeBytes?: number | null;
  vramSizeBytes?: number | null;
}): AiRuntimeAccelerationState {
  const normalizedLabel = processorLabel?.toUpperCase() ?? '';
  const hasGpu = normalizedLabel.includes('GPU');
  const hasCpu = normalizedLabel.includes('CPU');

  if (hasGpu && hasCpu) {
    return 'mixed';
  }

  if (hasGpu) {
    return 'gpu';
  }

  if (hasCpu) {
    return 'cpu';
  }

  if (typeof vramSizeBytes === 'number') {
    if (vramSizeBytes <= 0) {
      return 'cpu';
    }

    if (typeof totalSizeBytes === 'number' && totalSizeBytes > 0) {
      return vramSizeBytes >= totalSizeBytes ? 'gpu' : 'mixed';
    }

    return 'mixed';
  }

  return 'unknown';
}

function buildPlanningStatusLabel({
  accelerationState,
  modelAvailable,
  processorLabel,
}: {
  accelerationState: AiRuntimeAccelerationState;
  modelAvailable: boolean;
  processorLabel: string | null;
}) {
  if (!modelAvailable) {
    return 'Planning model is not installed in local Ollama.';
  }

  switch (accelerationState) {
    case 'gpu':
      return processorLabel
        ? `Planning is using GPU acceleration (${processorLabel}).`
        : 'Planning is using GPU acceleration.';
    case 'mixed':
      return processorLabel
        ? `Planning is using mixed acceleration (${processorLabel}).`
        : 'Planning is using mixed CPU and GPU acceleration.';
    case 'cpu':
      return processorLabel
        ? `Planning is currently CPU-bound (${processorLabel}).`
        : 'Planning is currently CPU-bound.';
    case 'idle':
      return 'Planning model is idle. GPU acceleration will be verified when planning starts.';
    default:
      return 'Planning acceleration could not be verified yet.';
  }
}

async function fetchJson<T>(url: string, timeoutMs: number) {
  const parsedUrl = new URL(url);

  try {
    const { response } = await fetchOllamaWithFallback({
      baseUrl: parsedUrl.origin,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      init: {
        cache: 'no-store',
        signal: createTimeoutSignal(timeoutMs),
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function warmLocalOllamaModel({
  baseUrl,
  model,
}: {
  baseUrl: string;
  model: string;
}) {
  let response: Response;

  try {
    const warmupResponse = await fetchOllamaWithFallback({
      baseUrl,
      path: '/api/chat',
      init: {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: createTimeoutSignal(WARMUP_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          stream: false,
          keep_alive: '10m',
          messages: [
            {
              role: 'user',
              content: 'Reply with ok.',
            },
          ],
        }),
      },
    });

    response = warmupResponse.response;
  } catch (error) {
    throw new ServiceUnavailableError(
      buildOllamaConnectionFailureMessage({
        baseUrl,
        error,
      })
    );
  }

  if (!response.ok) {
    throw new ServiceUnavailableError(
      `Failed to warm the local planning model "${model}"`
    );
  }

  await response.json().catch(() => null);
}

async function inspectLocalOllamaRuntime({
  baseUrl,
  model,
}: {
  baseUrl: string;
  model: string;
}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const [tagResponse, processResponse] = await Promise.all([
    fetchJson<OllamaListResponse>(`${normalizedBaseUrl}/api/tags`, STATUS_TIMEOUT_MS),
    fetchJson<OllamaPsResponse>(`${normalizedBaseUrl}/api/ps`, STATUS_TIMEOUT_MS),
  ]);

  const taggedModels = tagResponse?.models ?? [];
  const runningModels = processResponse?.models ?? [];
  const modelAvailable = taggedModels.some((taggedModel) =>
    modelMatches(taggedModel.name ?? taggedModel.model, model)
  );
  const runningModel =
    runningModels.find((candidate) =>
      modelMatches(candidate.name ?? candidate.model, model)
    ) ?? null;
  const processorLabel = runningModel?.processor?.trim() || null;
  const totalSizeBytes = runningModel?.size ?? null;
  const vramSizeBytes = runningModel?.size_vram ?? null;
  const accelerationState = runningModel
    ? resolveAccelerationState({
        processorLabel,
        totalSizeBytes,
        vramSizeBytes,
      })
    : modelAvailable
      ? 'idle'
      : 'unknown';

  return {
    accelerationState,
    modelAvailable,
    processorLabel,
  };
}

export async function getLocalOllamaRuntimeStatus({
  baseUrl,
  model,
}: {
  baseUrl: string;
  model: string;
}): Promise<LocalOllamaRuntimeStatus> {
  const inspectedRuntime = await inspectLocalOllamaRuntime({
    baseUrl,
    model,
  });
  const planningReady =
    inspectedRuntime.modelAvailable &&
    inspectedRuntime.accelerationState !== 'cpu';

  return {
    ...inspectedRuntime,
    planningReady,
    planningStatusLabel: buildPlanningStatusLabel(inspectedRuntime),
  };
}

export async function ensureLocalOllamaPlanningReady({
  baseUrl,
  model,
}: {
  baseUrl: string;
  model: string;
}) {
  let runtimeStatus = await inspectLocalOllamaRuntime({
    baseUrl,
    model,
  });

  if (!runtimeStatus.modelAvailable) {
    throw new ServiceUnavailableError(
      `Planning model "${model}" is not installed in local Ollama`
    );
  }

  if (runtimeStatus.accelerationState === 'idle') {
    await warmLocalOllamaModel({
      baseUrl,
      model,
    });

    runtimeStatus = await inspectLocalOllamaRuntime({
      baseUrl,
      model,
    });
  }

  if (runtimeStatus.accelerationState === 'cpu') {
    throw new ServiceUnavailableError(
      'Planning requires GPU-backed Ollama, but the local planning model is currently running on CPU'
    );
  }

  if (
    runtimeStatus.accelerationState !== 'gpu' &&
    runtimeStatus.accelerationState !== 'mixed'
  ) {
    throw new ServiceUnavailableError(
      'Planning could not verify GPU acceleration for the local Ollama model'
    );
  }

  return {
    ...runtimeStatus,
    planningReady: true,
    planningStatusLabel: buildPlanningStatusLabel(runtimeStatus),
  } satisfies LocalOllamaRuntimeStatus;
}
