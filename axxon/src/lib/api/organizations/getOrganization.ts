import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';
import { buildOrganizationApiPath } from '@/lib/utils/routes';

export async function fetchOrganization(
  organizationId: string
): Promise<OrganizationSummary> {
  const res = await apiFetch(buildOrganizationApiPath(organizationId), {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch organization');
  }

  return res.json();
}
