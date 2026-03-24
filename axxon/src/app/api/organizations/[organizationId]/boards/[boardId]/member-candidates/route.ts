import { NextRequest, NextResponse } from 'next/server';
import { searchBoardInviteCandidates } from '@/lib/controllers/boardMembers/boardMemberControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { requireOrganizationBoardCreator } from '@/lib/utils/organizationBoardRoute';
import type { RouteContext } from '@/lib/utils/apiRoute';

type BoardMemberCandidatesRouteParams = {
  organizationId: string;
  boardId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<BoardMemberCandidatesRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await requireOrganizationBoardCreator(
      context,
      session.userId
    );
    const candidates = await searchBoardInviteCandidates({
      organizationId,
      boardId,
      sessionUserId: session.userId,
      query: req.nextUrl.searchParams.get('query') ?? '',
    });

    return NextResponse.json(candidates, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[SEARCH_BOARD_MEMBER_CANDIDATES_ERROR]',
      'Failed to search board member candidates'
    );
  }
}
