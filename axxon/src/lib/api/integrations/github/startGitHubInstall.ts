// Starts the browser-side request that creates a GitHub App installation URL for an organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type { GithubInstallStartResponse } from '@/lib/types/githubIntegrationTypes';
import { buildOrganizationGitHubInstallApiPath } from '@/lib/utils/routes';

export async function startGitHubInstall(
  organizationId: string | number
): Promise<GithubInstallStartResponse> {
  const res = await apiFetch(buildOrganizationGitHubInstallApiPath(organizationId), {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('Failed to start GitHub installation');
  }

  return (await res.json()) as GithubInstallStartResponse;
}
