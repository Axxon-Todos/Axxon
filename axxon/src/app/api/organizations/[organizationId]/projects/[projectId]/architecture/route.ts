// Reads and validates project architecture drafts and commits immutable revisions.
import { NextRequest, NextResponse } from 'next/server';
import { commitProjectArchitecture, getProjectArchitecture, updateProjectArchitecture } from '@/lib/controllers/projects/projectControllers';
import type { ArchitectureDraftInput } from '@/lib/types/architectureTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationProjectMember } from '@/lib/utils/organizationProjectRoute';

type Params = { organizationId: string; projectId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    return NextResponse.json(await getProjectArchitecture({ ...params, userId: session.userId }));
  } catch (error) {
    return handleApiError(error, '[GET_PROJECT_ARCHITECTURE_ERROR]', 'Failed to get project architecture');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const data = await parseJsonBody<ArchitectureDraftInput>(request);
    return NextResponse.json(await updateProjectArchitecture({ ...params, userId: session.userId, data }));
  } catch (error) {
    return handleApiError(error, '[UPDATE_PROJECT_ARCHITECTURE_ERROR]', 'Failed to update project architecture');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const data = await parseJsonBody<{ summary?: string | null }>(request);
    return NextResponse.json(await commitProjectArchitecture({ ...params, userId: session.userId, summary: data.summary }));
  } catch (error) {
    return handleApiError(error, '[COMMIT_PROJECT_ARCHITECTURE_ERROR]', 'Failed to commit project architecture');
  }
}
