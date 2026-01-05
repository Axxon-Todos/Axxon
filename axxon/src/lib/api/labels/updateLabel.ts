export async function updateLabel(
  boardId: string | number,
  labelId: number,
  data: { name?: string; color?: string }
) {
  const res = await fetch(`/api/board/${boardId}/labels/${labelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update label')
  return res.json()
}
