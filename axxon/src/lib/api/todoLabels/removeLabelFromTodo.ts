import { apiFetch } from '@/lib/api/apiFetch';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function removeLabelFromTodo(
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
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    throw new Error('Failed to remove label from todo');
  }

  return res.json();
}
