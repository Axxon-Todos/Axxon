// Exposes authorized replies on an architecture comment thread.
import { NextRequest, NextResponse } from 'next/server';
import { addArchitectureComment } from '@/lib/agents/architecture/collaborationService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; threadId: string };

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    const data = await parseJsonBody<{ body?: string }>(request);
    return NextResponse.json(await addArchitectureComment({ organizationId: parseNumericRouteParam(params.organizationId, 'organization id'), projectId: parseNumericRouteParam(params.projectId, 'project id'), threadId: parseNumericRouteParam(params.threadId, 'thread id'), userId: session.userId, body: data.body || '' }), { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_ARCHITECTURE_COMMENT_ERROR]', 'Failed to create architecture comment');
  }
}
