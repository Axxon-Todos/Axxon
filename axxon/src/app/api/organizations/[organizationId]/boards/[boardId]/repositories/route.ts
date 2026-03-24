import { NextRequest, NextResponse } from 'next/server';
import {
  getBoardRepositories,
  replaceBoardRepositories,
} from '@/lib/controllers/boardRepositoryAccess/boardRepositoryAccessControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { parseOrganizationBoardParams } from '@/lib/utils/organizationBoardRoute';

type BoardRepositoriesRouteParams = {
  organizationId: string;
  boardId: string;
};

type ReplaceBoardRepositoriesPayload = {
  repositoryIds: number[];
};

export async function GET(
  req: NextRequest,
  context: RouteContext<BoardRepositoriesRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await parseOrganizationBoardParams(context);
    const result = await getBoardRepositories({
      organizationId,
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_BOARD_REPOSITORIES_ERROR]',
      'Failed to fetch board repositories'
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext<BoardRepositoriesRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, boardId } = await parseOrganizationBoardParams(context);
    const data = await parseJsonBody<ReplaceBoardRepositoriesPayload>(req);
    const result = await replaceBoardRepositories({
      organizationId,
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[REPLACE_BOARD_REPOSITORIES_ERROR]',
      'Failed to update board repositories'
    );
  }
}
