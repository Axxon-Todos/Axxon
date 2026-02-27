export async function addLabelToTodo(
  boardId: string | number,
  todoId: number,
  labelId: number
) {
  const res = await fetch(
    `/api/board/${boardId}/todos/${todoId}/labels/${labelId}`,
    {
      method: 'POST',
      credentials: 'include',
    }
  )
  if (!res.ok) throw new Error('Failed to add label to todo')
  return res.json()
}
