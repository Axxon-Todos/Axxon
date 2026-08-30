// Approves a review-ready plan and persists a durable dispatch request instead of executing code inline.
import { NextRequest, NextResponse } from 'next/server';
import { approveAgentPlan } from '@/lib/agents/application/runService';
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
    return NextResponse.json(await approveAgentPlan({ organizationId, boardId, runId: parseNumericRouteParam(runId, 'agent run id'), userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[APPROVE_AGENT_PLAN_ERROR]', 'Failed to approve agent plan');
  }
}
