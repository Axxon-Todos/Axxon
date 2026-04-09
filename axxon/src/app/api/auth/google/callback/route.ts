// Completes Google OAuth PKCE and redirects back to the same origin used to start the flow in development.
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { completeGoogleOAuthLogin } from '@/lib/controllers/auth/authController';
import { BadRequestError, handleApiError } from '@/lib/utils/apiErrors';
import { issueSessionCookie } from '@/lib/utils/auth';
import {
  clearGoogleOAuthCookies,
  readGoogleOAuthCookies,
  resolveGoogleOAuthRedirectUri,
  resolveGoogleOAuthReturnOrigin,
  resolveRequestOrigin,
} from '@/lib/utils/googleOAuth';

export async function GET(req: NextRequest) {
  try {
    const oauthError = req.nextUrl.searchParams.get('error');
    const oauthErrorDescription = req.nextUrl.searchParams.get('error_description');
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const oauthCookies = readGoogleOAuthCookies(req);

    if (oauthError) {
      throw new BadRequestError(oauthErrorDescription || 'Google OAuth authorization failed');
    }

    if (!code) {
      throw new BadRequestError('Authorization code not provided');
    }

    if (!state || !oauthCookies.state || state !== oauthCookies.state) {
      throw new BadRequestError('Google OAuth state validation failed');
    }

    if (!oauthCookies.codeVerifier) {
      throw new BadRequestError('Google OAuth code verifier is missing');
    }

    const requestOrigin = resolveRequestOrigin(req);
    const redirectUri = resolveGoogleOAuthRedirectUri(requestOrigin);
    const user = await completeGoogleOAuthLogin({
      code,
      codeVerifier: oauthCookies.codeVerifier,
      redirectUri,
    });

    // Set cookie and redirect
    const response = NextResponse.redirect(
      new URL(
        '/dashboard',
        resolveGoogleOAuthReturnOrigin(requestOrigin)
      )
    );
    clearGoogleOAuthCookies(response);
    await issueSessionCookie(response, {
      id: user.id,
      email: user.email,
      name: user.first_name,
    });

    return response;
  } catch (error) {
    const response = handleApiError(
      error,
      '[GOOGLE_OAUTH_CALLBACK_ERROR]',
      'Failed to complete Google OAuth login'
    );
    clearGoogleOAuthCookies(response);
    return response;
  }
}
