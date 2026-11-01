// Exposes project-scoped architecture-agent run creation and history.
import { NextRequest, NextResponse } from 'next/server';
import { createArchitectureAgentRun, listArchitectureAgentRuns } from '@/lib/agents/architecture/runService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationProjectMember } from '@/lib/utils/organizationProjectRoute';

type Params = { organizationId: string; projectId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    return NextResponse.json(await listArchitectureAgentRuns({ ...params, userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[LIST_ARCHITECTURE_AGENT_RUNS_ERROR]', 'Failed to list architecture agent runs');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const data = await parseJsonBody<{ prompt?: string; intent?: string; target?: Record<string, unknown> | null }>(request);
    return NextResponse.json(await createArchitectureAgentRun({ ...params, userId: session.userId, prompt: data.prompt || '', intent: data.intent, target: data.target }), { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_ARCHITECTURE_AGENT_RUN_ERROR]', 'Failed to create architecture agent run');
  }
}
