// /lib/api/getTodosWithLabels.ts
import { apiFetch } from '@/lib/api/apiFetch';

export async function fetchTodosWithLabels(boardId: string) {
  const res = await apiFetch(`/api/board/${boardId}/todos-with-labels`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch todos with labels');
  }

  return res.json();
}
