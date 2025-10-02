export async function reorderCategories(boardId: string, newOrder: string[]) {
  const res = await fetch(`/api/board/${boardId}/categories/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newOrder }),
  });

  if (!res.ok) {
    throw new Error(`Failed to reorder categories: ${res.statusText}`);
  }
  return res.json();
}
