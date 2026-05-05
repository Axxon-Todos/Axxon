// Lists and creates board-bound AI planning sessions for authenticated board members.
import { NextRequest, NextResponse } from 'next/server';

import {
  createOrganizationAiPlanningSession,
  listOrganizationAiPlanningSessions,
} from '@/lib/controllers/ai/organizationAiPlanningControllers';
import type { PlanningSessionCreateRequest } from '@/lib/types/organizationAiPlanningTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type PlanningSessionsRouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<PlanningSessionsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardMember(
      context,
      session.userId
    );
    const response = await listOrganizationAiPlanningSessions({
      organizationId,
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_ORGANIZATION_AI_PLANNING_SESSIONS_ERROR]',
      'Failed to list planning sessions'
    );
  }
}

export async function POST(
  req: NextRequest,
  context: RouteContext<PlanningSessionsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardMember(
      context,
      session.userId
    );
    const data = await parseJsonBody<PlanningSessionCreateRequest>(req);
    const response = await createOrganizationAiPlanningSession({
      organizationId,
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[CREATE_ORGANIZATION_AI_PLANNING_SESSION_ERROR]',
      'Failed to create planning session'
    );
  }
}
