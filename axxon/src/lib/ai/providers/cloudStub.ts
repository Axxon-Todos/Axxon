// Provides a controlled placeholder for the production cloud AI provider until credentials are configured.
import { ServiceUnavailableError } from '@/lib/utils/apiErrors';

// Fail fast in non-local stages until the real cloud adapter is implemented intentionally.
export async function streamCloudAiChatStub(): Promise<never> {
  throw new ServiceUnavailableError(
    'Cloud AI provider is not configured for this environment yet'
  );
}
