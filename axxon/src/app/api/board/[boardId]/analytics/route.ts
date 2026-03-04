import { NextRequest, NextResponse } from 'next/server';
import { getBoardAnalytics } from '@/lib/controllers/boardAnalytics/getBoardAnalytics';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, RouteContext } from '@/lib/utils/apiRoute';

type BoardAnalyticsRouteParams = {
  boardId: string;
};

export async function GET(req: NextRequest, context: RouteContext<BoardAnalyticsRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await context.params;
    const analytics = await getBoardAnalytics({
      boardId: parseNumericRouteParam(boardId, 'board id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_BOARD_ANALYTICS_ERROR]', 'Failed to fetch board analytics');
  }
}
