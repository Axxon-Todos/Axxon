import { NextRequest, NextResponse } from 'next/server';
import {
  deleteLabel,
  getLabelById,
  updateLabel,
} from '@/lib/controllers/labels/labelControllers';
import type { UpdateLabelData } from '@/lib/types/labelTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';

type LabelRouteParams = {
  boardId: string;
  labelId: string;
};

type UpdateLabelPayload = Partial<Pick<UpdateLabelData, 'name' | 'color'>>;

export async function GET(req: NextRequest, context: RouteContext<LabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, labelId } = await context.params;
    const label = await getLabelById({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      labelId: parseNumericRouteParam(labelId, 'label id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(label, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_LABEL_BY_ID_ERROR]', 'Failed to retrieve label');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext<LabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, labelId } = await context.params;
    const data = await parseJsonBody<UpdateLabelPayload>(req);
    const label = await updateLabel({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      labelId: parseNumericRouteParam(labelId, 'label id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(label, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_LABEL_ERROR]', 'Failed to update label');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<LabelRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, labelId } = await context.params;
    const result = await deleteLabel({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      labelId: parseNumericRouteParam(labelId, 'label id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DELETE_LABEL_ERROR]', 'Failed to delete label');
  }
}
