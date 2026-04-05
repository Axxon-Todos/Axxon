import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function deleteTodoById(
  organizationId: string | number,
  boardId: string | number,
  todoId: string | number
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, `/todos/${todoId}`),
    {
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete todo');
  }

  return res.json();
}
