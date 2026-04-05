import { apiFetch } from '@/lib/api/apiFetch';
import type { UpdateTodoData } from '@/lib/types/todoTypes';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

type UpdateTodoInput = Partial<
  Pick<
    UpdateTodoData,
    'title' | 'description' | 'due_date' | 'assignee_id' | 'priority' | 'category_id' | 'sprint_id' | 'is_complete'
  >
>;

export async function updateTodoById(
  organizationId: string | number,
  boardId: string | number,
  todoId: string | number,
  data: UpdateTodoInput
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
