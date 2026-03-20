import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchTodos(organizationId: string, boardId: string) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, '/todos'),
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to fetch todos');
  }

  return res.json();
}
