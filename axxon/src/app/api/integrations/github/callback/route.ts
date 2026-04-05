// Completes the GitHub OAuth callback and redirects the user back to the org setup flow.
import { NextRequest, NextResponse } from 'next/server';
import { resolveGitHubAuthorizationCallbackRedirect } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { getAppBaseUrl } from '@/lib/github/env';
import { handleApiError } from '@/lib/utils/apiErrors';

export async function GET(req: NextRequest) {
  try {
    const redirectPath = await resolveGitHubAuthorizationCallbackRedirect({
      code: req.nextUrl.searchParams.get('code'),
      state: req.nextUrl.searchParams.get('state'),
      error: req.nextUrl.searchParams.get('error'),
    });

    return NextResponse.redirect(new URL(redirectPath, getAppBaseUrl()));
  } catch (error) {
    return handleApiError(
      error,
      '[GITHUB_CALLBACK_ERROR]',
      'Failed to complete the GitHub callback'
    );
  }
}
