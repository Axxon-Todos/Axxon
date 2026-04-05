// Wraps the browser-side request that completes GitHub installation setup for an organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type {
  GithubFinalizeRequest,
  GithubFinalizeResponse,
} from '@/lib/types/githubIntegrationTypes';
import { buildOrganizationGitHubFinalizeApiPath } from '@/lib/utils/routes';

export async function finalizeGitHubInstallationRequest(
  organizationId: string | number,
  data: GithubFinalizeRequest
): Promise<GithubFinalizeResponse> {
  const res = await apiFetch(buildOrganizationGitHubFinalizeApiPath(organizationId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let message = 'Failed to finalize GitHub installation';

    try {
      const error = (await res.json()) as { error?: string };
      message = error.error || message;
    } catch {
      // noop
    }

    throw new Error(message);
  }

  return (await res.json()) as GithubFinalizeResponse;
}
