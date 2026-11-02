// Accepts the accessible structured discovery answers for a project architecture run.
import { NextRequest, NextResponse } from 'next/server';
import { submitArchitectureDiscoveryAnswers } from '@/lib/agents/architecture/runService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';
import { parseOrganizationProjectParams } from '@/lib/utils/organizationProjectRoute';
import { requireProjectMember } from '@/lib/utils/authorization';
import type { AgentClarificationAnswer } from '@/lib/agents/domain';

type Params = { organizationId: string; projectId: string; runId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await parseOrganizationProjectParams(context);
    await requireProjectMember(params.organizationId, params.projectId, session.userId);
    const route = await context.params;
    const body = await parseJsonBody<{ answers?: AgentClarificationAnswer[] }>(request);
    return NextResponse.json(await submitArchitectureDiscoveryAnswers({ ...params, runId: parseNumericRouteParam(route.runId, 'agent run id'), userId: session.userId, answers: body.answers || [] }));
  } catch (error) {
    return handleApiError(error, '[SUBMIT_ARCHITECTURE_DISCOVERY_ERROR]', 'Failed to submit architecture discovery answers');
  }
}
