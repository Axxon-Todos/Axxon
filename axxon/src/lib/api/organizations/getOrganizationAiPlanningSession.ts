// Fetches one persisted planning session with its transcript, planner state, and final structured plan.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type { PlanningSessionDetail } from '@/lib/types/organizationAiPlanningTypes';
import { buildOrganizationBoardAiPlanningSessionApiPath } from '@/lib/utils/routes';

export async function fetchOrganizationAiPlanningSession(
  organizationId: string,
  boardId: string,
  sessionId: number
): Promise<PlanningSessionDetail> {
  const response = await apiFetch(
    buildOrganizationBoardAiPlanningSessionApiPath(organizationId, boardId, sessionId),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Failed to fetch planning session')
    );
  }

  return response.json();
}
