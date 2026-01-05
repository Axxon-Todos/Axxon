export async function removeLabelFromTodo(
  boardId: string | number,
  todoId: number,
  labelId: number
) {
  const res = await fetch(
    `/api/board/${boardId}/todos/${todoId}/labels/${labelId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  )
  if (!res.ok) throw new Error('Failed to remove label from todo')
  return res.json()
}
