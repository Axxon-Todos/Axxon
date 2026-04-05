// Calls the org-scoped member invite endpoint for existing Axxon users.
import { apiFetch } from '@/lib/api/apiFetch';
import type { InviteOrganizationMembersResponse } from '@/lib/types/organizationTypes';
import { buildOrganizationMembersApiPath } from '@/lib/utils/routes';

export async function inviteOrganizationMembers({
  organizationId,
  userIds,
}: {
  organizationId: string | number;
  userIds: number[];
}): Promise<InviteOrganizationMembersResponse> {
  const response = await apiFetch(buildOrganizationMembersApiPath(organizationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to invite organization members');
  }

  return response.json();
}
