// Wraps the browser-side request that resyncs repositories for an organization's GitHub install.
import { apiFetch } from '@/lib/api/apiFetch';
import type { GithubSyncResponse } from '@/lib/types/githubIntegrationTypes';
import { buildOrganizationGitHubSyncApiPath } from '@/lib/utils/routes';

export async function syncGitHubRepositories(
  organizationId: string | number
): Promise<GithubSyncResponse> {
  const res = await apiFetch(buildOrganizationGitHubSyncApiPath(organizationId), {
    method: 'POST',
  });

  if (!res.ok) {
    let message = 'Failed to sync GitHub repositories';

    try {
      const error = (await res.json()) as { error?: string };
      message = error.error || message;
    } catch {
      // noop
    }

    throw new Error(message);
  }

  return (await res.json()) as GithubSyncResponse;
}
