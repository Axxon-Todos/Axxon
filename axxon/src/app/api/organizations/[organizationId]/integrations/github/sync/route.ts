// Triggers a fresh repository sync for the organization's active GitHub installation.
import { NextRequest, NextResponse } from 'next/server';
import { syncOrganizationGitHubRepositories } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type GitHubSyncRouteParams = {
  organizationId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<GitHubSyncRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const response = await syncOrganizationGitHubRepositories({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[SYNC_GITHUB_REPOSITORIES_ERROR]',
      'Failed to sync GitHub repositories'
    );
  }
}
