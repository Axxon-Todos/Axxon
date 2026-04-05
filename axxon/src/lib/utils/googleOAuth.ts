import crypto from 'node:crypto';

import type { NextRequest, NextResponse } from 'next/server';

const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state';
const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = 'google_oauth_code_verifier';
const GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;
const GOOGLE_OAUTH_COOKIE_PATH = '/api/auth/google';
const GOOGLE_OAUTH_SCOPE = 'openid email profile';

type RequestWithCookies = Pick<NextRequest, 'cookies'>;

export type GoogleOAuthConfig = {
  clientId: string;
  redirectUri: string;
};

export type GoogleOAuthTransientState = {
  codeVerifier: string;
  state: string;
};

function isSecureCookieEnabled() {
  return process.env.NODE_ENV === 'production';
}

export function getGoogleOAuthStateCookieName() {
  return GOOGLE_OAUTH_STATE_COOKIE_NAME;
}

export function getGoogleOAuthCodeVerifierCookieName() {
  return GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.NEXT_PUBLIC_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Google OAuth configuration is incomplete');
  }

  return { clientId, redirectUri };
}

export function createGoogleOAuthState() {
  return crypto.randomBytes(32).toString('base64url');
}

export function createGooglePkceCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

export function createGooglePkceCodeChallenge(codeVerifier: string) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

export function buildGoogleAuthorizationUrl({
  codeChallenge,
  state,
}: {
  codeChallenge: string;
  state: string;
}) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return authUrl;
}

export function issueGoogleOAuthCookies(
  response: NextResponse,
  { codeVerifier, state }: GoogleOAuthTransientState
) {
  const cookieOptions = {
    httpOnly: true,
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS,
    path: GOOGLE_OAUTH_COOKIE_PATH,
    sameSite: 'lax' as const,
    secure: isSecureCookieEnabled(),
  };

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
  response.cookies.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, cookieOptions);
}

export function clearGoogleOAuthCookies(response: NextResponse) {
  const cookieOptions = {
    httpOnly: true,
    maxAge: 0,
    path: GOOGLE_OAUTH_COOKIE_PATH,
    sameSite: 'lax' as const,
    secure: isSecureCookieEnabled(),
  };

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, '', cookieOptions);
  response.cookies.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, '', cookieOptions);
}

export function readGoogleOAuthCookies(req: RequestWithCookies): GoogleOAuthTransientState {
  return {
    codeVerifier: req.cookies.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)?.value ?? '',
    state: req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value ?? '',
  };
}
