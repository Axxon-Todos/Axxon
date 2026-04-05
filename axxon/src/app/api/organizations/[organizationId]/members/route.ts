import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationMembers,
  inviteOrganizationMembers,
  searchOrganizationInviteCandidates,
} from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationMemberRouteParams = {
  organizationId: string;
};

type InviteOrganizationMembersPayload = {
  userIds: number[];
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

export async function POST(
  req: NextRequest,
  context: RouteContext<OrganizationMemberRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<InviteOrganizationMembersPayload>(req);
    const result = await inviteOrganizationMembers({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[INVITE_ORGANIZATION_MEMBERS_ERROR]',
      'Failed to invite organization members'
    );
  }
}
