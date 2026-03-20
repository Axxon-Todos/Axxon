import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationMembers } from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type OrganizationMemberRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationMemberRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const members = await getOrganizationMembers({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_ORGANIZATION_MEMBERS_ERROR]',
      'Failed to list organization members'
    );
  }
}
