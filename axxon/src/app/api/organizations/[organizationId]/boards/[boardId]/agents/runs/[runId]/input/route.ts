// Submits structured clarification input for an authorized agent run and queues its next turn.
import { NextRequest, NextResponse } from 'next/server';
import { submitAgentInput } from '@/lib/agents/application/runService';
import type { SubmitAgentInputCommand } from '@/lib/agents/domain';
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
    const data = await parseJsonBody<SubmitAgentInputCommand>(request);
    return NextResponse.json(await submitAgentInput({ organizationId, boardId, runId: parseNumericRouteParam(runId, 'agent run id'), userId: session.userId, data }));
  } catch (error) {
    return handleApiError(error, '[SUBMIT_AGENT_INPUT_ERROR]', 'Failed to submit agent input');
  }
}
