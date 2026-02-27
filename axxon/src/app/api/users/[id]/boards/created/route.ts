import { listBoardsCreatedByUser } from '@/lib/controllers/board/listBoardCreator';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, RouteContext } from '@/lib/utils/apiRoute';
import { NextRequest, NextResponse } from 'next/server';

type UserBoardRouteParams = {
  id: string;
};

export async function GET(req: NextRequest, context: RouteContext<UserBoardRouteParams>) {
  try {
    const session = await requireSession(req);
    const { id } = await context.params;
    const boards = await listBoardsCreatedByUser({
      userId: parseNumericRouteParam(id, 'user id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(boards, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_BY_BOARD_CREATOR_ERROR]',
      'Failed to show boards made by user'
    );
  }
}
