// Starts the Google OAuth PKCE flow and binds the callback origin to the current request in development.
'use server';

import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/utils/apiErrors';
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  createGooglePkceCodeChallenge,
  createGooglePkceCodeVerifier,
  issueGoogleOAuthCookies,
  resolveGoogleOAuthRedirectUri,
  resolveRequestOrigin,
} from '@/lib/utils/googleOAuth';

export async function GET(req: NextRequest) {
  try {
    const state = createGoogleOAuthState();
    const codeVerifier = createGooglePkceCodeVerifier();
    const codeChallenge = createGooglePkceCodeChallenge(codeVerifier);
    const redirectUri = resolveGoogleOAuthRedirectUri(resolveRequestOrigin(req));
    const response = NextResponse.redirect(
      buildGoogleAuthorizationUrl({ codeChallenge, redirectUri, state })
    );

    issueGoogleOAuthCookies(response, { codeVerifier, state });

    return response;
  } catch (error) {
    return handleApiError(
      error,
      '[GOOGLE_OAUTH_START_ERROR]',
      'Failed to start Google OAuth login'
    );
  }
}
