import { apiFetch } from '@/lib/api/apiFetch';

export async function deleteLabel(
  boardId: string | number,
  labelId: number
) {
  const res = await apiFetch(`/api/board/${boardId}/labels/${labelId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete label')
  return res.json()
}
