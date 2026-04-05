import { apiFetch } from '@/lib/api/apiFetch';
import type { SprintBaseData } from '@/lib/types/sprintTypes';

export async function fetchSprints(boardId: string): Promise<SprintBaseData[]> {
  const res = await apiFetch(`/api/board/${boardId}/sprints`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch sprints');
  }

  return res.json();
}
