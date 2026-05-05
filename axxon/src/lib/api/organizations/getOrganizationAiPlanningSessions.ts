// Fetches creator-owned planning session summaries for the selected board in the org AI workspace.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type { PlanningSession } from '@/lib/types/organizationAiPlanningTypes';
import { buildOrganizationBoardAiPlanningSessionsApiPath } from '@/lib/utils/routes';

export async function fetchOrganizationAiPlanningSessions(
  organizationId: string,
  boardId: string
): Promise<PlanningSession[]> {
  const response = await apiFetch(
    buildOrganizationBoardAiPlanningSessionsApiPath(organizationId, boardId),
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Failed to fetch planning sessions')
    );
  }

  return response.json();
}
