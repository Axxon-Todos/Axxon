import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchLabels(
  organizationId: string,
  boardId: string
): Promise<{ id: number; board_id: number; name: string; color: string }[]> {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/labels'),
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch labels');
  }

  return res.json();
}
