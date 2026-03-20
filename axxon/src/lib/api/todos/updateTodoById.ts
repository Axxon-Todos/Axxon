import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function updateTodoById(
  organizationId: string | number,
  boardId: string | number,
  todoId: string | number,
  data: any
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(organizationId, boardId, `/todos/${todoId}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update todo');
  }

  return res.json();
}
