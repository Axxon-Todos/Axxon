// Creates a new project architecture revision from an earlier immutable snapshot.
import { NextRequest, NextResponse } from 'next/server';
import { revertProjectRevision } from '@/lib/controllers/projects/revisionControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseNumericRouteParam, type RouteContext } from '@/lib/utils/apiRoute';

type Params = { organizationId: string; projectId: string; revisionId: string };

// Handles authorized revision rollback without deleting history.
export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await context.params;
    return NextResponse.json(await revertProjectRevision({
      organizationId: parseNumericRouteParam(params.organizationId, 'organization id'),
      projectId: parseNumericRouteParam(params.projectId, 'project id'),
      revisionId: parseNumericRouteParam(params.revisionId, 'revision id'),
      userId: session.userId,
    }), { status: 201 });
  } catch (error) {
    return handleApiError(error, '[REVERT_PROJECT_REVISION_ERROR]', 'Failed to revert architecture revision');
  }
}
