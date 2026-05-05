// Reads the canonical JSON API error shape and falls back to a caller-provided message when needed.
export async function readApiError(
  response: Response,
  fallbackMessage: string
) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
