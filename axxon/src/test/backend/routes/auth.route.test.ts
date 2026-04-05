import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockedCompleteGoogleOAuthLogin,
  mockedIssueSessionCookie,
} = vi.hoisted(() => ({
  mockedCompleteGoogleOAuthLogin: vi.fn(),
  mockedIssueSessionCookie: vi.fn(),
}));

vi.mock('@/lib/controllers/auth/authController', () => ({
  completeGoogleOAuthLogin: mockedCompleteGoogleOAuthLogin,
}));

vi.mock('@/lib/utils/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/auth')>('@/lib/utils/auth');

  return {
    ...actual,
    issueSessionCookie: mockedIssueSessionCookie,
  };
});

import { GET as legacyGoogleLogin } from '@/app/api/auth/google/route';
import { GET as completeGoogleLogin } from '@/app/api/auth/google/callback/route';
import { GET as startGoogleLogin } from '@/app/api/auth/google/start/route';
import {
  getGoogleOAuthCodeVerifierCookieName,
  getGoogleOAuthStateCookieName,
} from '@/lib/utils/googleOAuth';

describe('Google auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/auth/google/callback');
    vi.stubEnv('NEXT_PUBLIC_HOSTNAME', 'http://localhost:3000');
    mockedIssueSessionCookie.mockResolvedValue('session-token');
  });

  it('redirects the legacy Google auth route to the PKCE start endpoint', async () => {
    const response = await legacyGoogleLogin(
      new NextRequest('http://localhost:3000/api/auth/google')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/api/auth/google/start');
  });

  it('starts Google OAuth with state and PKCE cookies', async () => {
    const response = await startGoogleLogin();
    const location = response.headers.get('location');
    const setCookieHeader = response.headers.get('set-cookie');

    expect(response.status).toBe(307);
    expect(location).toBeTruthy();
    expect(setCookieHeader).toContain(getGoogleOAuthStateCookieName());
    expect(setCookieHeader).toContain(getGoogleOAuthCodeVerifierCookieName());

    const authUrl = new URL(location!);

    expect(authUrl.origin).toBe('https://accounts.google.com');
    expect(authUrl.searchParams.get('state')).toBeTruthy();
    expect(authUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('rejects callbacks with mismatched OAuth state', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auth/google/callback?code=valid-code&state=wrong-state',
      {
        headers: {
          cookie: `${getGoogleOAuthStateCookieName()}=expected-state; ${getGoogleOAuthCodeVerifierCookieName()}=code-verifier`,
        },
      }
    );

    const response = await completeGoogleLogin(request);
    const setCookieHeader = response.headers.get('set-cookie');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Google OAuth state validation failed',
    });
    expect(mockedCompleteGoogleOAuthLogin).not.toHaveBeenCalled();
    expect(setCookieHeader).toContain(`${getGoogleOAuthStateCookieName()}=`);
    expect(setCookieHeader).toContain('Max-Age=0');
  });

  it('accepts callbacks with matching transient OAuth cookies', async () => {
    mockedCompleteGoogleOAuthLogin.mockResolvedValue({
      email: 'user@example.com',
      first_name: 'Grace',
      id: 7,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/auth/google/callback?code=valid-code&state=expected-state',
      {
        headers: {
          cookie: `${getGoogleOAuthStateCookieName()}=expected-state; ${getGoogleOAuthCodeVerifierCookieName()}=code-verifier`,
        },
      }
    );

    const response = await completeGoogleLogin(request);
    const setCookieHeader = response.headers.get('set-cookie');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(mockedCompleteGoogleOAuthLogin).toHaveBeenCalledWith({
      code: 'valid-code',
      codeVerifier: 'code-verifier',
    });
    expect(mockedIssueSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'user@example.com',
        id: 7,
        name: 'Grace',
      })
    );
    expect(setCookieHeader).toContain(`${getGoogleOAuthCodeVerifierCookieName()}=`);
    expect(setCookieHeader).toContain('Max-Age=0');
  });
});
