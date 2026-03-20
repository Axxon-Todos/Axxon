import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function addLabelToTodo(
  organizationId: string | number,
  boardId: string | number,
  todoId: number,
  labelId: number
) {
  const res = await apiFetch(
    buildOrganizationBoardApiPath(
      organizationId,
      boardId,
      `/todos/${todoId}/labels/${labelId}`
    ),
    {
      method: 'POST',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to add label to todo');
  }

  return res.json();
}
