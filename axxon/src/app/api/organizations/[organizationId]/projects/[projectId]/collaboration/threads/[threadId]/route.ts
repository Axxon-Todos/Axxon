// Exposes authorized resolution and reopening for architecture comment threads.
import { NextRequest, NextResponse } from 'next/server';
import { resolveArchitectureThread } from '@/lib/agents/architecture/collaborationService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; threadId: string };

export async function PATCH(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    const data = await parseJsonBody<{ resolved?: boolean }>(request);
    return NextResponse.json(await resolveArchitectureThread({ organizationId: parseNumericRouteParam(params.organizationId, 'organization id'), projectId: parseNumericRouteParam(params.projectId, 'project id'), threadId: parseNumericRouteParam(params.threadId, 'thread id'), userId: session.userId, resolved: data.resolved !== false }));
  } catch (error) {
    return handleApiError(error, '[RESOLVE_ARCHITECTURE_THREAD_ERROR]', 'Failed to update architecture comment thread');
  }
}
