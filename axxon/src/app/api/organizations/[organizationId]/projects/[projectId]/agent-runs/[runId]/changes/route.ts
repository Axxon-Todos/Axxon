// Records reviewer feedback for a project-scoped architecture proposal.
import { NextRequest, NextResponse } from 'next/server';
import { requestArchitectureChanges } from '@/lib/agents/architecture/reviewService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; runId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    const data = await parseJsonBody<{ feedback?: string }>(request);
    return NextResponse.json(await requestArchitectureChanges({ organizationId: parseNumericRouteParam(params.organizationId, 'organization id'), projectId: parseNumericRouteParam(params.projectId, 'project id'), runId: parseNumericRouteParam(params.runId, 'agent run id'), userId: session.userId, feedback: data.feedback || '' }));
  } catch (error) {
    return handleApiError(error, '[REQUEST_ARCHITECTURE_CHANGES_ERROR]', 'Failed to request architecture changes');
  }
}
