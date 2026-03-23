// Loads the connected GitHub installation summary and active repositories for an organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationRepositoriesResponse } from '@/lib/types/githubIntegrationTypes';
import { buildOrganizationRepositoriesApiPath } from '@/lib/utils/routes';

export async function getOrganizationRepositories(
  organizationId: string | number
): Promise<OrganizationRepositoriesResponse> {
  const res = await apiFetch(buildOrganizationRepositoriesApiPath(organizationId), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to load connected repositories');
  }

  return (await res.json()) as OrganizationRepositoriesResponse;
}
