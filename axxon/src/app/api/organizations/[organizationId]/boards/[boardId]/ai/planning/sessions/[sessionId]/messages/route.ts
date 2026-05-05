// Appends a user reply to a planning session and advances the clarification or planning loop.
import { NextRequest, NextResponse } from 'next/server';

import { createOrganizationAiPlanningSessionMessage } from '@/lib/controllers/ai/organizationAiPlanningControllers';
import type { PlanningSessionMessageRequest } from '@/lib/types/organizationAiPlanningTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type PlanningSessionMessageRouteParams = {
  organizationId: string;
  boardId: string;
  sessionId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<PlanningSessionMessageRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardMember(
      context,
      session.userId
    );
    const { sessionId } = await context.params;
    const data = await parseJsonBody<PlanningSessionMessageRequest>(req);
    const response = await createOrganizationAiPlanningSessionMessage({
      organizationId,
      boardId,
      sessionId: parseNumericRouteParam(sessionId, 'planning session id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[CREATE_ORGANIZATION_AI_PLANNING_MESSAGE_ERROR]',
      'Failed to update planning session'
    );
  }
}
