'use server';

import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/utils/apiErrors';
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  createGooglePkceCodeChallenge,
  createGooglePkceCodeVerifier,
  issueGoogleOAuthCookies,
} from '@/lib/utils/googleOAuth';

export async function GET() {
  try {
    const state = createGoogleOAuthState();
    const codeVerifier = createGooglePkceCodeVerifier();
    const codeChallenge = createGooglePkceCodeChallenge(codeVerifier);
    const response = NextResponse.redirect(
      buildGoogleAuthorizationUrl({ codeChallenge, state })
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
