// Reads a project architecture revision and optionally returns its semantic diff.
import { NextRequest, NextResponse } from 'next/server';
import { inspectProjectRevision } from '@/lib/controllers/projects/revisionControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; revisionId: string };

// Handles revision inspection for an authorized project member.
export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    const compareToValue = request.nextUrl.searchParams.get('compareTo');
    return NextResponse.json(await inspectProjectRevision({
      organizationId: parseNumericRouteParam(params.organizationId, 'organization id'),
      projectId: parseNumericRouteParam(params.projectId, 'project id'),
      revisionId: parseNumericRouteParam(params.revisionId, 'revision id'),
      compareTo: compareToValue ? parseNumericRouteParam(compareToValue, 'comparison revision id') : undefined,
      userId: session.userId,
    }));
  } catch (error) {
    return handleApiError(error, '[GET_PROJECT_REVISION_ERROR]', 'Failed to get architecture revision');
  }
}
