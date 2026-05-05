// Re-enqueues the latest retryable planner run for a board-bound planning session and returns the refreshed snapshot.
import { NextRequest, NextResponse } from 'next/server';

import { processOrganizationAiPlanningSession } from '@/lib/controllers/ai/organizationAiPlanningControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type PlanningSessionProcessRouteParams = {
  organizationId: string;
  boardId: string;
  sessionId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<PlanningSessionProcessRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardMember(
      context,
      session.userId
    );
    const { sessionId } = await context.params;
    const response = await processOrganizationAiPlanningSession({
      organizationId,
      boardId,
      sessionId: parseNumericRouteParam(sessionId, 'planning session id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[PROCESS_ORGANIZATION_AI_PLANNING_SESSION_ERROR]',
      'Failed to process planning session'
    );
  }
}
