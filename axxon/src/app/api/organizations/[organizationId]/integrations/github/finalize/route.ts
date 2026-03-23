// Finalizes an organization's GitHub installation after the setup handoff returns from GitHub.
import { NextRequest, NextResponse } from 'next/server';
import { finalizeOrganizationGitHubInstall } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type GitHubFinalizeRouteParams = {
  organizationId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<GitHubFinalizeRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<unknown>(req);
    const response = await finalizeOrganizationGitHubInstall({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[FINALIZE_GITHUB_INSTALL_ERROR]',
      'Failed to finalize GitHub installation'
    );
  }
}
