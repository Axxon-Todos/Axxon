import { listBoardsForUser } from '@/lib/controllers/boardMembers/boardMemberControllers';
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
    const boards = await listBoardsForUser({
      userId: parseNumericRouteParam(id, 'user id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(boards, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[FETCH_BOARDS_DATA_ERROR]', 'Failed to fetch boards');
  }
}
