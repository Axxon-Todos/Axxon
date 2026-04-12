// Returns a creator-owned org AI chat thread with its persisted ordered messages.
import { NextRequest, NextResponse } from 'next/server';

import { getOrganizationAiThread } from '@/lib/controllers/ai/organizationAiControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationAiThreadRouteParams = {
  organizationId: string;
  threadId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationAiThreadRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId, threadId } = await context.params;
    const response = await getOrganizationAiThread({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      threadId: parseNumericRouteParam(threadId, 'thread id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[GET_ORGANIZATION_AI_THREAD_ERROR]',
      'Failed to fetch AI chat thread'
    );
  }
}
