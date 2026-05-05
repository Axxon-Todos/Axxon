// Sends either a freeform planning reply or a structured clarification batch and returns the updated planning snapshot.
import { apiFetch } from '@/lib/api/apiFetch';
import { readApiError } from '@/lib/api/readApiError';
import type {
  PlanningQuestionAnswerInput,
  PlanningSessionDetail,
  PlanningSessionMessageRequest,
} from '@/lib/types/organizationAiPlanningTypes';
import { buildOrganizationBoardAiPlanningSessionMessagesApiPath } from '@/lib/utils/routes';

export async function createOrganizationAiPlanningSessionMessage({
  organizationId,
  boardId,
  sessionId,
  mode,
  content,
  answers,
  signal,
}: {
  organizationId: string | number;
  boardId: string | number;
  sessionId: string | number;
  mode: 'freeform' | 'clarification_batch';
  content?: string;
  answers?: PlanningQuestionAnswerInput[];
  signal?: AbortSignal;
}): Promise<PlanningSessionDetail> {
  const request: PlanningSessionMessageRequest =
    mode === 'clarification_batch'
      ? {
          mode,
          answers: answers ?? [],
        }
      : {
          mode,
          content: content ?? '',
        };
  const response = await apiFetch(
    buildOrganizationBoardAiPlanningSessionMessagesApiPath(
      organizationId,
      boardId,
      sessionId
    ),
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
      await readApiError(response, 'Failed to update planning session')
    );
  }

  return response.json();
}
