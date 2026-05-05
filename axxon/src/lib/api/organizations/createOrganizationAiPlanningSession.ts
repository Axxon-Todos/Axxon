// Creates a board-bound planning session and returns the full structured planning snapshot.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type {
  PlanningSessionCreateRequest,
  PlanningSessionDetail,
} from '@/lib/types/organizationAiPlanningTypes';
import { buildOrganizationBoardAiPlanningSessionsApiPath } from '@/lib/utils/routes';

export async function createOrganizationAiPlanningSession({
  organizationId,
  boardId,
  content,
  signal,
}: {
  organizationId: string | number;
  boardId: string | number;
  content: string;
  signal?: AbortSignal;
}): Promise<PlanningSessionDetail> {
  const request: PlanningSessionCreateRequest = {
    content,
  };
  const response = await apiFetch(
    buildOrganizationBoardAiPlanningSessionsApiPath(organizationId, boardId),
    {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Failed to create planning session')
    );
  }

  return response.json();
}
