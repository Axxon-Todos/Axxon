import { NextRequest, NextResponse } from 'next/server';

import { createSprint, listSprints } from '@/lib/controllers/sprints/sprintControllers';
import type { CreateSprintData } from '@/lib/types/sprintTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type RouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(req: NextRequest, context: RouteContext<RouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const sprints = await listSprints({
      boardId,
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
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<Omit<CreateSprintData, 'board_id'>>(req);
    const sprint = await createSprint({
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_SPRINT_ERROR]', 'Failed to create sprint');
  }
}
