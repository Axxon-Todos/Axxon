// Adds existing organization members to a board using user ids.
import { apiFetch } from '@/lib/api/apiFetch';
import type { AddBoardMembersResponse } from '@/lib/types/boardMemberTypes';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function addBoardMembers({
  organizationId,
  boardId,
  userIds,
}: {
  organizationId: string | number;
  boardId: string | number;
  userIds: number[];
}): Promise<AddBoardMembersResponse> {
  const response = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/member'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to add board members');
  }

  return response.json();
}
