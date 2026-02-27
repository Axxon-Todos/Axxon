export async function deleteLabel(
  boardId: string | number,
  labelId: number
) {
  const res = await fetch(`/api/board/${boardId}/labels/${labelId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to delete label')
  return res.json()
}
