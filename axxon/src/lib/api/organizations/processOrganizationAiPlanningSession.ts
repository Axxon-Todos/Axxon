// Re-enqueues the latest retryable planning run for a session and returns the refreshed snapshot.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type { PlanningSessionDetail } from '@/lib/types/organizationAiPlanningTypes';
import { buildOrganizationBoardAiPlanningSessionProcessApiPath } from '@/lib/utils/routes';

export async function processOrganizationAiPlanningSession({
  organizationId,
  boardId,
  sessionId,
}: {
  organizationId: string | number;
  boardId: string | number;
  sessionId: string | number;
}): Promise<PlanningSessionDetail> {
  const response = await apiFetch(
    buildOrganizationBoardAiPlanningSessionProcessApiPath(
      organizationId,
      boardId,
      sessionId
    ),
    {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Failed to process planning session')
    );
  }

  return response.json();
}
