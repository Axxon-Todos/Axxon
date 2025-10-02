export async function updateCategoryById(
  boardId: string | number,
  categoryId: number,
  data: Partial<{ name?: string; color?: string; position?: number; is_done?: boolean }>
) {
  const res = await fetch(`/api/board/${boardId}/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to update category')
  }

  return res.json()
}
