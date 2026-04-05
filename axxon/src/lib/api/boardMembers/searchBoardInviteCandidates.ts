// Fetches organization members who can still be added to a specific board.
import { apiFetch } from '@/lib/api/apiFetch';
import type { User } from '@/lib/types/users';
import { buildOrganizationBoardMemberCandidatesApiPath } from '@/lib/utils/routes';

export async function searchBoardInviteCandidates(
  organizationId: string | number,
  boardId: string | number,
  query: string
): Promise<User[]> {
  const searchParams = new URLSearchParams({ query });
  const response = await apiFetch(
    `${buildOrganizationBoardMemberCandidatesApiPath(organizationId, boardId)}?${searchParams.toString()}`,
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to search board invite candidates');
  }

  return response.json();
}
