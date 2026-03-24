// Fetches the repositories explicitly linked to a board.
import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardRepositoriesResponse } from '@/lib/types/boardRepositoryAccessTypes';
import { buildOrganizationBoardRepositoriesApiPath } from '@/lib/utils/routes';

export async function getBoardRepositories(
  organizationId: string | number,
  boardId: string | number
): Promise<BoardRepositoriesResponse> {
  const response = await apiFetch(
    buildOrganizationBoardRepositoriesApiPath(organizationId, boardId),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to fetch board repositories');
  }

  return response.json();
}
