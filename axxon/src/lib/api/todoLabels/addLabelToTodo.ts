import { apiFetch } from '@/lib/api/apiFetch';

export async function addLabelToTodo(
  boardId: string | number,
  todoId: number,
  labelId: number
) {
  const res = await apiFetch(
    `/api/board/${boardId}/todos/${todoId}/labels/${labelId}`,
    {
      method: 'POST',
    }
  )
  if (!res.ok) throw new Error('Failed to add label to todo')
  return res.json()
}
