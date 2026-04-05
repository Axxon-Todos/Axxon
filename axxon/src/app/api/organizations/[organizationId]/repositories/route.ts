// Returns the current GitHub installation summary and active repositories for an organization.
import { NextRequest, NextResponse } from 'next/server';
import { listOrganizationRepositories } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationRepositoriesRouteParams = {
  organizationId: string;
};

export async function GET(
  req: NextRequest,
  context: RouteContext<OrganizationRepositoriesRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const response = await listOrganizationRepositories({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_ORGANIZATION_REPOSITORIES_ERROR]',
      'Failed to list organization repositories'
    );
  }
}
