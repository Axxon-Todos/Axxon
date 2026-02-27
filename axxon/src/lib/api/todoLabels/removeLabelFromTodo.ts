import { apiFetch } from '@/lib/api/apiFetch';

export async function removeLabelFromTodo(
  boardId: string | number,
  todoId: number,
  labelId: number
) {
  const res = await apiFetch(
    `/api/board/${boardId}/todos/${todoId}/labels/${labelId}`,
    {
      method: 'DELETE',
    }
  )
  if (!res.ok) throw new Error('Failed to remove label from todo')
  return res.json()
}
