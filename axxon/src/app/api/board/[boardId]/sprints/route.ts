import { NextRequest, NextResponse } from 'next/server';
import { createSprint, listSprints } from '@/lib/controllers/sprints/sprintControllers';
import type { CreateSprintData } from '@/lib/types/sprintTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type RouteParams = {
  boardId: string;
};

export async function GET(req: NextRequest, context: RouteContext<RouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const sprints = await listSprints({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(sprints, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_SPRINTS_ERROR]', 'Failed to list sprints');
  }
}

export async function POST(req: NextRequest, context: RouteContext<RouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<Omit<CreateSprintData, 'board_id'>>(req);
    const sprint = await createSprint({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_SPRINT_ERROR]', 'Failed to create sprint');
  }
}
