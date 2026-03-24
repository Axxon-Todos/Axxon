import { NextRequest, NextResponse } from 'next/server';
import { searchOrganizationInviteCandidates } from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationMemberCandidatesRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationMemberCandidatesRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const candidates = await searchOrganizationInviteCandidates({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      query: req.nextUrl.searchParams.get('query') ?? '',
    });

    return NextResponse.json(candidates, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[SEARCH_ORGANIZATION_MEMBER_CANDIDATES_ERROR]',
      'Failed to search organization invite candidates'
    );
  }
}
