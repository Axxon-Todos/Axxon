import { getBoardById } from '@/lib/controllers/board/getById';
import { updateBoard } from '@/lib/controllers/board/update';
import { deleteBoard } from '@/lib/controllers/board/delete';
import type { UpdateBoard } from '@/lib/types/boardTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import {
  requireOrganizationBoardCreator,
  requireOrganizationBoardMember,
} from '@/lib/utils/organizationBoardRoute';
import { NextRequest, NextResponse } from 'next/server';

type BoardRouteParams = {
  organizationId: string;
  boardId: string;
};

type UpdateBoardPayload = Partial<Pick<UpdateBoard, 'name' | 'color'>>;

export async function GET(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const board = await getBoardById({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(board, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_BOARD_BY_ID_ERROR]', 'Failed to get board by id');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardCreator(context, session.userId);
    const data = await parseJsonBody<UpdateBoardPayload>(req);
    const board = await updateBoard({
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(board, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_BOARD_ERROR]', 'Failed to update board');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardCreator(context, session.userId);
    const result = await deleteBoard({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DELETE_BOARD_ERROR]', 'Failed to delete board');
  }
}
