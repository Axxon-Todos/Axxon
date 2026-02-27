// lib/api/categories/deleteCategoryById.ts
export async function deleteCategoryById(boardId: string | number, categoryId: string | number) {
  const res = await fetch(`/api/board/${boardId}/categories/${categoryId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error?.error || 'Failed to delete category');
  }

  return res.json();
}
