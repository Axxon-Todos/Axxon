// Approves and applies a project-scoped architecture proposal.
import { NextRequest, NextResponse } from 'next/server';
import { approveArchitectureProposal } from '@/lib/agents/architecture/reviewService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; runId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    return NextResponse.json(await approveArchitectureProposal({ organizationId: parseNumericRouteParam(params.organizationId, 'organization id'), projectId: parseNumericRouteParam(params.projectId, 'project id'), runId: parseNumericRouteParam(params.runId, 'agent run id'), userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[APPROVE_ARCHITECTURE_PROPOSAL_ERROR]', 'Failed to approve architecture proposal');
  }
}
