import { apiFetch } from '@/lib/api/apiFetch';
import type { OrganizationMemberRecord } from '@/lib/types/organizationMemberTypes';
import { buildOrganizationMembersApiPath } from '@/lib/utils/routes';

export async function fetchOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberRecord[]> {
  const res = await apiFetch(buildOrganizationMembersApiPath(organizationId), {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch organization members');
  }

  return res.json();
}
