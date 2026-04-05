// Fetches matching existing Axxon users who are not already in the target organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type { User } from '@/lib/types/users';
import { buildOrganizationMemberCandidatesApiPath } from '@/lib/utils/routes';

export async function searchOrganizationInviteCandidates(
  organizationId: string | number,
  query: string
): Promise<User[]> {
  const searchParams = new URLSearchParams({ query });
  const response = await apiFetch(
    `${buildOrganizationMemberCandidatesApiPath(organizationId)}?${searchParams.toString()}`,
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to search organization invite candidates');
  }

  return response.json();
}
