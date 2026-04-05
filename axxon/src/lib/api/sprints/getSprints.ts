import { apiFetch } from '@/lib/api/apiFetch';
import type { SprintBaseData } from '@/lib/types/sprintTypes';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchSprints(
  organizationId: string | number,
  boardId: string | number
): Promise<SprintBaseData[]> {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/sprints'),
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch sprints');
  }

  return res.json();
}
