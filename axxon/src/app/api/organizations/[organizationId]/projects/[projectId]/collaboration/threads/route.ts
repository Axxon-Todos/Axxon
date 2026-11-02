// Exposes authorized project architecture comment thread listing and creation.
import { NextRequest, NextResponse } from 'next/server';
import { createArchitectureThread, listArchitectureThreads } from '@/lib/agents/architecture/collaborationService';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationProjectMember } from '@/lib/utils/organizationProjectRoute';

type Params = { organizationId: string; projectId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    return NextResponse.json(await listArchitectureThreads({ ...params, userId: session.userId, status: new URL(request.url).searchParams.get('status') || undefined }));
  } catch (error) {
    return handleApiError(error, '[LIST_ARCHITECTURE_THREADS_ERROR]', 'Failed to list architecture comment threads');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const data = await parseJsonBody<{ body?: string; componentId?: string | null; relationshipId?: string | null; revisionId?: number | null; proposalRunId?: number | null }>(request);
    return NextResponse.json(await createArchitectureThread({ ...params, userId: session.userId, body: data.body || '', componentId: data.componentId, relationshipId: data.relationshipId, revisionId: data.revisionId, proposalRunId: data.proposalRunId }), { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_ARCHITECTURE_THREAD_ERROR]', 'Failed to create architecture comment thread');
  }
}
