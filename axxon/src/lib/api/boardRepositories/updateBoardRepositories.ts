// Replaces the repository allowlist assigned to a board.
import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardRepositoriesResponse } from '@/lib/types/boardRepositoryAccessTypes';
import { buildOrganizationBoardRepositoriesApiPath } from '@/lib/utils/routes';

export async function updateBoardRepositories({
  organizationId,
  boardId,
  repositoryIds,
}: {
  organizationId: string | number;
  boardId: string | number;
  repositoryIds: number[];
}): Promise<BoardRepositoriesResponse> {
  const response = await apiFetch(
    buildOrganizationBoardRepositoriesApiPath(organizationId, boardId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositoryIds }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to update board repositories');
  }

  return response.json();
}
