import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationBoardRepositoryAccess } from '@/lib/controllers/boardRepositoryAccess/boardRepositoryAccessControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationBoardRepositoryAccessRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationBoardRepositoryAccessRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const result = await getOrganizationBoardRepositoryAccess({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_ORGANIZATION_BOARD_REPOSITORY_ACCESS_ERROR]',
      'Failed to fetch organization board repository access'
    );
  }
}
