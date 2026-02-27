import { apiFetch } from '@/lib/api/apiFetch';

export async function deleteTodoById(boardId: string | number, todoId: string | number) {
  const res = await apiFetch(`/api/board/${boardId}/todos/${todoId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete todo');
  }

  return res.json();
}
