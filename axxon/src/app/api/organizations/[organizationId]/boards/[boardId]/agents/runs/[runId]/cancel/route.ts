// Cancels an active agent run through the state machine without deleting its audit history.
import { NextRequest, NextResponse } from 'next/server';
import { cancelAgentRun } from '@/lib/agents/application/runService';
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
    return NextResponse.json(await cancelAgentRun({ organizationId, boardId, runId: parseNumericRouteParam(runId, 'agent run id'), userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[CANCEL_AGENT_RUN_ERROR]', 'Failed to cancel agent run');
  }
}
