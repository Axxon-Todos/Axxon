import { NextRequest, NextResponse } from 'next/server';
import { createLabel, listLabels } from '@/lib/controllers/labels/labelControllers';
import type { CreateLabelData } from '@/lib/types/labelTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type RouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(req: NextRequest, context: RouteContext<RouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const labels = await listLabels({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(labels, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[LIST_LABELS_ERROR]', 'Failed to list labels');
  }
}

export async function POST(req: NextRequest, context: RouteContext<RouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<Omit<CreateLabelData, 'board_id'>>(req);
    const label = await createLabel({
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_LABEL_ERROR]', 'Failed to create label');
  }
}
