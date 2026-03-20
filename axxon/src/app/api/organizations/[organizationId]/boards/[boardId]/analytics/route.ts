import { NextRequest, NextResponse } from 'next/server';
import { getBoardAnalytics } from '@/lib/controllers/boardAnalytics/getBoardAnalytics';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type BoardAnalyticsRouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<BoardAnalyticsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const analytics = await getBoardAnalytics({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[GET_BOARD_ANALYTICS_ERROR]', 'Failed to fetch board analytics');
  }
}
