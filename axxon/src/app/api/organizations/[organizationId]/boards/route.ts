import { NextRequest, NextResponse } from 'next/server';
import {
  createOrganizationBoard,
  listBoardsForOrganization,
} from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationBoardRouteParams = {
  organizationId: string;
};

type CreateBoardPayload = {
  name: string;
  color?: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationBoardRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const boards = await listBoardsForOrganization({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(boards, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_ORGANIZATION_BOARDS_ERROR]',
      'Failed to list organization boards'
    );
  }
}

export async function POST(
  req: NextRequest,
  context: RouteContext<OrganizationBoardRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<CreateBoardPayload>(req);
    const board = await createOrganizationBoard({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    return handleApiError(
      error,
      '[CREATE_ORGANIZATION_BOARD_ERROR]',
      'Failed to create board'
    );
  }
}
