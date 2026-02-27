import { NextRequest, NextResponse } from 'next/server';
import { createLabel, listLabels } from '@/lib/controllers/labels/labelControllers';
import type { CreateLabelData } from '@/lib/types/labelTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';

type RouteParams = {
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<RouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const labels = await listLabels({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(labels, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_LABELS_ERROR]', 'Failed to list labels');
  }
}

export async function POST(
  req: NextRequest,
  context: RouteContext<RouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<Omit<CreateLabelData, 'board_id'>>(req);
    const label = await createLabel({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_LABEL_ERROR]', 'Failed to create label');
  }
}
