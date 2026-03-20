import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchTodosWithLabels(
  organizationId: string,
  boardId: string
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/todos-with-labels'),
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch todos with labels');
  }

  return res.json();
}
