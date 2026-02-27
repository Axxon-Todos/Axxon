// lib/api/getLabels.ts
import { apiFetch } from '@/lib/api/apiFetch';

export async function fetchLabels(boardId: string): Promise<{ id: number; board_id: number; name: string; color: string }[]> {
  const res = await apiFetch(`/api/board/${boardId}/labels`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}
