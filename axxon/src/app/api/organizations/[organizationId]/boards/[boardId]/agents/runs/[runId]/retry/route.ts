// Requeues a failed agent run after verifying the caller has operational authority.
import { NextRequest, NextResponse } from 'next/server';
import { retryAgentRun } from '@/lib/agents/application/runService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type Params = { organizationId: string; boardId: string; runId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId, boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { runId } = await context.params;
    return NextResponse.json(await retryAgentRun({ organizationId, boardId, runId: parseNumericRouteParam(runId, 'agent run id'), userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[RETRY_AGENT_RUN_ERROR]', 'Failed to retry agent run');
  }
}
