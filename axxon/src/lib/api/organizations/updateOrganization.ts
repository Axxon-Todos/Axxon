import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationApiPath } from '@/lib/utils/routes';
import type { OrganizationSummary, OrganizationUpdate } from '@/lib/types/organizationTypes';

export async function updateOrganizationById(
  organizationId: string | number,
  data: OrganizationUpdate
): Promise<OrganizationSummary> {
  const res = await apiFetch(buildOrganizationApiPath(organizationId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to update organization');
  }

  return res.json();
}
