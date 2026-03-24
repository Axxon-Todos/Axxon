// Removes a single member from a board.
import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function removeBoardMember({
  organizationId,
  boardId,
  userId,
}: {
  organizationId: string | number;
  boardId: string | number;
  userId: string | number;
}) {
  const response = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, `/member/${userId}`),
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to remove board member');
  }

  return response.json();
}
