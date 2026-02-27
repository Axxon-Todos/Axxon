import { NextRequest, NextResponse } from 'next/server';
import {
  getBoardMemberById,
  removeBoardMember,
} from '@/lib/controllers/boardMembers/boardMemberControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, RouteContext } from '@/lib/utils/apiRoute';

type BoardMemberRouteParams = {
  boardId: string;
  userId: string;
};

export async function GET(req: NextRequest, context: RouteContext<BoardMemberRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, userId } = await context.params;
    const member = await getBoardMemberById({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      userId: parseNumericRouteParam(userId, 'user id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_BOARD_MEMBER_BY_ID_ERROR]', 'Failed to get board member by ID');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext<BoardMemberRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId, userId } = await context.params;
    const result = await removeBoardMember({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      userId: parseNumericRouteParam(userId, 'user id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[BOARD_MEMBER_REMOVAL_ERROR]', 'Failed to remove board member');
  }
}
