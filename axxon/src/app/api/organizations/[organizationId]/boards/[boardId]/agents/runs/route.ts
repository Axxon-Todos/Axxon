// Lists shared board agent runs and creates a queued run without performing work inline.
import { NextRequest, NextResponse } from 'next/server';
import { createAgentRun, listAgentRuns } from '@/lib/agents/application/runService';
import type { CreateAgentRunCommand } from '@/lib/agents/domain';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type Params = { organizationId: string; boardId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId, boardId } = await requireOrganizationBoardMember(context, session.userId);
    return NextResponse.json(await listAgentRuns({ organizationId, boardId, userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[LIST_AGENT_RUNS_ERROR]', 'Failed to list agent runs');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId, boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<CreateAgentRunCommand>(request);
    const run = await createAgentRun({ organizationId, boardId, userId: session.userId, data });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_AGENT_RUN_ERROR]', 'Failed to create agent run');
  }
}
