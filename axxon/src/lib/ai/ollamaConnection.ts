// Retries legacy Ollama Docker hostnames against host-accessible aliases when the configured endpoint is unreachable.
const RETRYABLE_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

const OLLAMA_HOST_FALLBACKS: Record<string, string[]> = {
  ollama: ['host.docker.internal', '127.0.0.1', 'localhost'],
  'host.docker.internal': ['127.0.0.1', 'localhost'],
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function readErrorCode(error: unknown) {
  const errorRecord =
    error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
  const errorCause =
    errorRecord?.cause && typeof errorRecord.cause === 'object'
      ? (errorRecord.cause as Record<string, unknown>)
      : null;

  if (
    errorCause &&
    'code' in errorCause &&
    typeof errorCause.code === 'string'
  ) {
    return errorCause.code;
  }

  if (errorRecord && 'code' in errorRecord && typeof errorRecord.code === 'string') {
    return errorRecord.code;
  }

  return null;
}

function isRetryableConnectionError(error: unknown) {
  const errorCode = readErrorCode(error);

  if (errorCode) {
    return RETRYABLE_CONNECTION_ERROR_CODES.has(errorCode);
  }

  return error instanceof TypeError;
}

export function buildOllamaBaseUrlCandidates(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  try {
    const parsedUrl = new URL(normalizedBaseUrl);
    const fallbackHosts = OLLAMA_HOST_FALLBACKS[parsedUrl.hostname] ?? [];
    const candidates = [normalizedBaseUrl];

    for (const fallbackHost of fallbackHosts) {
      const nextUrl = new URL(parsedUrl.toString());

      nextUrl.hostname = fallbackHost;
      const nextCandidate = normalizeBaseUrl(nextUrl.toString());

      if (!candidates.includes(nextCandidate)) {
        candidates.push(nextCandidate);
      }
    }

    return candidates;
  } catch {
    return [normalizedBaseUrl];
  }
}

export function buildOllamaConnectionFailureMessage({
  baseUrl,
  error,
}: {
  baseUrl: string;
  error: unknown;
}) {
  const attempts = buildOllamaBaseUrlCandidates(baseUrl)
    .map((candidate) => `"${candidate}"`)
    .join(', ');
  const errorMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'Unknown connection failure';

  return `Could not reach local Ollama. Tried ${attempts}. ${errorMessage}`;
}

export async function fetchOllamaWithFallback({
  baseUrl,
  path,
  init,
}: {
  baseUrl: string;
  path: string;
  init?: RequestInit;
}) {
  const candidates = buildOllamaBaseUrlCandidates(baseUrl);
  let lastError: unknown = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidateBaseUrl = candidates[index];

    try {
      const response = await fetch(`${candidateBaseUrl}${path}`, init);

      return {
        response,
      };
    } catch (error) {
      lastError = error;

      if (
        index === candidates.length - 1 ||
        !isRetryableConnectionError(error)
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Local Ollama request failed');
}
