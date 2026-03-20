import { NextRequest, NextResponse } from 'next/server';
import { getOrganization } from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type OrganizationRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const organization = await getOrganization({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(organization, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_ORGANIZATION_ERROR]',
      'Failed to get organization'
    );
  }
}
