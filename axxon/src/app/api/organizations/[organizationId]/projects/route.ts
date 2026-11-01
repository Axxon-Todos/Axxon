// Exposes organization-scoped project listing and architecture project creation.
import { NextRequest, NextResponse } from 'next/server';
import { createProject, listProjectsForOrganization } from '@/lib/controllers/projects/projectControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId } = await context.params;
    return NextResponse.json(await listProjectsForOrganization(parseNumericRouteParam(organizationId, 'organization id'), session.userId));
  } catch (error) {
    return handleApiError(error, '[LIST_PROJECTS_ERROR]', 'Failed to list projects');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<{ name?: string; description?: string | null }>(request);
    return NextResponse.json(await createProject({ organizationId: parseNumericRouteParam(organizationId, 'organization id'), userId: session.userId, ...data }), { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_PROJECT_ERROR]', 'Failed to create project');
  }
}
