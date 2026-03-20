import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationMemberRecord } from '@/lib/types/organizationMemberTypes';

export async function fetchOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberRecord[]> {
  const res = await apiFetch(`/api/organizations/${organizationId}/members`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch organization members');
  }

  return res.json();
}
