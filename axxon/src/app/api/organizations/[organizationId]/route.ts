import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganization,
  updateOrganization,
} from '@/lib/controllers/organizations/organizationControllers';
import type { OrganizationUpdate } from '@/lib/types/organizationTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationRouteParams = {
  organizationId: string;
};

type UpdateOrganizationPayload = OrganizationUpdate;

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

export async function PATCH(
  req: NextRequest,
  context: RouteContext<OrganizationRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<UpdateOrganizationPayload>(req);
    const organization = await updateOrganization({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(organization, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[UPDATE_ORGANIZATION_ERROR]',
      'Failed to update organization'
    );
  }
}
