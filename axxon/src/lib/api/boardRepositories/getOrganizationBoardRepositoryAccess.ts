// Fetches the owner-only board-to-repository overview for an organization.
import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardRepositoryAccessMatrixResponse } from '@/lib/types/boardRepositoryAccessTypes';
import { buildOrganizationBoardRepositoryAccessApiPath } from '@/lib/utils/routes';

export async function getOrganizationBoardRepositoryAccess(
  organizationId: string | number
): Promise<BoardRepositoryAccessMatrixResponse> {
  const response = await apiFetch(
    buildOrganizationBoardRepositoryAccessApiPath(organizationId),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Failed to fetch board repository access overview');
  }

  return response.json();
}
