import { apiFetch } from '@/lib/api/apiFetch';
import type { BoardAnalyticsData } from '@/lib/types/boardAnalyticsTypes';
import { buildOrganizationBoardApiPath } from '@/lib/utils/routes';

export async function fetchBoardAnalytics(
  organizationId: string,
  boardId: string
): Promise<BoardAnalyticsData> {
  const res = await apiFetch(buildOrganizationBoardApiPath(organizationId, boardId, '/analytics'), {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch board analytics');
  }

  return res.json();
}
