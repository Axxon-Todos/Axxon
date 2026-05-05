// Returns one creator-owned board planning session with its transcript, planner state, and final artifact.
import { NextRequest, NextResponse } from 'next/server';

import { getOrganizationAiPlanningSession } from '@/lib/controllers/ai/organizationAiPlanningControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type PlanningSessionRouteParams = {
  organizationId: string;
  boardId: string;
  sessionId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<PlanningSessionRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardMember(
      context,
      session.userId
    );
    const { sessionId } = await context.params;
    const response = await getOrganizationAiPlanningSession({
      organizationId,
      boardId,
      sessionId: parseNumericRouteParam(sessionId, 'planning session id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_ORGANIZATION_AI_PLANNING_SESSION_ERROR]',
      'Failed to fetch planning session'
    );
  }
}
