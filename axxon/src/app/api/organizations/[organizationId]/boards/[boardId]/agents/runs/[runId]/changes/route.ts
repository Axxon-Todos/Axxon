// Sends review feedback to a plan-ready agent run and queues a new planning turn.
import { NextRequest, NextResponse } from 'next/server';
import { requestAgentChanges } from '@/lib/agents/application/runService';
import type { RequestAgentChangesCommand } from '@/lib/agents/domain';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type Params = { organizationId: string; boardId: string; runId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId, boardId } = await requireOrganizationBoardMember(context, session.userId);
    const { runId } = await context.params;
    const data = await parseJsonBody<RequestAgentChangesCommand>(request);
    return NextResponse.json(await requestAgentChanges({ organizationId, boardId, runId: parseNumericRouteParam(runId, 'agent run id'), userId: session.userId, data }));
  } catch (error) {
    return handleApiError(error, '[REQUEST_AGENT_CHANGES_ERROR]', 'Failed to request agent changes');
  }
}
