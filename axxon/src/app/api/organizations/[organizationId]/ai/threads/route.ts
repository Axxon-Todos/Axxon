// Lists creator-owned org AI chat threads for the authenticated organization member.
import { NextRequest, NextResponse } from 'next/server';

import { listOrganizationAiThreads } from '@/lib/controllers/ai/organizationAiControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationAiThreadsRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationAiThreadsRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const response = await listOrganizationAiThreads({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_ORGANIZATION_AI_THREADS_ERROR]',
      'Failed to list AI chat threads'
    );
  }
}
