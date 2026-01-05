export async function createLabel(
  boardId: string | number,
  data: { name: string; color?: string }
) {
  const res = await fetch(`/api/board/${boardId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create label')
  return res.json()
}
