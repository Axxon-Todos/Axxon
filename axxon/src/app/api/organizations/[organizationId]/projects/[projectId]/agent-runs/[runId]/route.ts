// Exposes a project-scoped run detail and durable progress event history.
import { NextRequest, NextResponse } from 'next/server';
import { getArchitectureAgentRun } from '@/lib/agents/architecture/runService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationProjectMember } from '@/lib/utils/organizationProjectRoute';

type Params = { organizationId: string; projectId: string; runId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const route = await context.params;
    return NextResponse.json(await getArchitectureAgentRun({ ...params, runId: Number(route.runId), userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[GET_ARCHITECTURE_AGENT_RUN_ERROR]', 'Failed to get architecture agent run');
  }
}
