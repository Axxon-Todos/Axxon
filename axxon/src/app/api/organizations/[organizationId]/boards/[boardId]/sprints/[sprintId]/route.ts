import { NextRequest, NextResponse } from 'next/server';

import { getSprintById, updateSprint } from '@/lib/controllers/sprints/sprintControllers';
import type { UpdateSprintData } from '@/lib/types/sprintTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type SprintRouteParams = {
  organizationId: string;
  boardId: string;
  sprintId: string;
};

type UpdateSprintPayload = Partial<
  Pick<UpdateSprintData, 'name' | 'description' | 'start_date' | 'end_date' | 'color' | 'icon' | 'archived_at'>
>;

export async function GET(req: NextRequest, context: RouteContext<SprintRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { sprintId } = await context.params;
    const sprint = await getSprintById({
      boardId,
      sprintId: parseNumericRouteParam(sprintId, 'sprint id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(sprint, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_SPRINT_BY_ID_ERROR]', 'Failed to retrieve sprint');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext<SprintRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { sprintId } = await context.params;
    const data = await parseJsonBody<UpdateSprintPayload>(req);
    const sprint = await updateSprint({
      boardId,
      sprintId: parseNumericRouteParam(sprintId, 'sprint id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(sprint, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_SPRINT_ERROR]', 'Failed to update sprint');
  }
}
