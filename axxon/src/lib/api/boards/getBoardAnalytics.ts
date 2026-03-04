import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardAnalyticsData } from '@/lib/types/boardAnalyticsTypes';

export async function fetchBoardAnalytics(boardId: string): Promise<BoardAnalyticsData> {
  const res = await apiFetch(`/api/board/${boardId}/analytics`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch board analytics');
  }

  return res.json();
}
