import { getBoardById } from '@/lib/controllers/board/getById';
import { updateBoard } from '@/lib/controllers/board/update';
import { deleteBoard } from '@/lib/controllers/board/delete';
import type { UpdateBoard } from '@/lib/types/boardTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  RouteContext,
} from '@/lib/utils/apiRoute';
import { NextRequest, NextResponse } from 'next/server';

type BoardRouteParams = {
  boardId: string;
};

type UpdateBoardPayload = Partial<Pick<UpdateBoard, 'name' | 'color'>>;

// Gets board by id
export async function GET(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const board = await getBoardById({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(board, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_BOARD_BY_ID_ERROR]', 'Failed to get board by id');
  }
}

// Updates board by id
export async function PATCH(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const data = await parseJsonBody<UpdateBoardPayload>(req);
    const board = await updateBoard({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(board, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[UPDATE_BOARD_ERROR]', 'Failed to update board');
  }
}

// Deletes board by id
export async function DELETE(req: NextRequest, context: RouteContext<BoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const result = await deleteBoard({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DELETE_BOARD_ERROR]', 'Failed to delete board');
  }
}
