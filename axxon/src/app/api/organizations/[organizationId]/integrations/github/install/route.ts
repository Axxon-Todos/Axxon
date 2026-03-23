// Starts the org-scoped GitHub App installation flow for organization owners.
import { NextRequest, NextResponse } from 'next/server';
import { startOrganizationGitHubInstall } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type GitHubInstallRouteParams = {
  organizationId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<GitHubInstallRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const response = await startOrganizationGitHubInstall({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[START_GITHUB_INSTALL_ERROR]',
      'Failed to start GitHub installation'
    );
  }
}
