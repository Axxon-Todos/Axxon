import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationSummary } from '@/lib/types/organizationTypes';

export async function fetchOrganization(
  organizationId: string
): Promise<OrganizationSummary> {
  const res = await apiFetch(`/api/organizations/${organizationId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch organization');
  }

  return res.json();
}
