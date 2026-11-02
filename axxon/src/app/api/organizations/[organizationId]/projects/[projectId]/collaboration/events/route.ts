// Returns append-only architecture collaboration events for reconnect backfill.
import { NextRequest, NextResponse } from 'next/server';
import { listArchitectureCollaborationEvents } from '@/lib/agents/architecture/collaborationService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    const search = new URL(request.url).searchParams;
    return NextResponse.json(await listArchitectureCollaborationEvents({ organizationId: parseNumericRouteParam(params.organizationId, 'organization id'), projectId: parseNumericRouteParam(params.projectId, 'project id'), userId: session.userId, afterId: Number(search.get('afterId') || 0), limit: Number(search.get('limit') || 100) }));
  } catch (error) {
    return handleApiError(error, '[LIST_ARCHITECTURE_COLLABORATION_EVENTS_ERROR]', 'Failed to list architecture collaboration events');
  }
}
