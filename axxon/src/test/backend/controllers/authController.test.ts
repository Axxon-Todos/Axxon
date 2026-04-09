// Verifies Google OAuth token exchange behavior and identity validation in the auth controller.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, UnauthorizedError } from '@/lib/utils/apiErrors';

const {
  mockedCreateRemoteJwkSet,
  mockedJwtVerify,
  mockedFindOrCreateByGoogle,
} = vi.hoisted(() => ({
  mockedCreateRemoteJwkSet: vi.fn(() => ({ mocked: true })),
  mockedJwtVerify: vi.fn(),
  mockedFindOrCreateByGoogle: vi.fn(),
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: mockedCreateRemoteJwkSet,
  jwtVerify: mockedJwtVerify,
}));

vi.mock('@/lib/models/users', () => ({
  Users: {
    findOrCreateByGoogle: mockedFindOrCreateByGoogle,
  },
}));

import {
  completeGoogleOAuthLogin,
} from '@/lib/controllers/auth/authController';

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
    delete process.env.NEXT_PUBLIC_REDIRECT_URI;
  });

  it('rejects missing authorization codes', async () => {
    await expect(
      completeGoogleOAuthLogin({
        code: '',
        codeVerifier: 'code-verifier',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
      })
    ).rejects.toBeInstanceOf(
      BadRequestError
    );
  });

  it('rejects missing PKCE code verifiers', async () => {
    await expect(
      completeGoogleOAuthLogin({
        code: 'valid-code',
        codeVerifier: '',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('surfaces token exchange failures as bad requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'invalid_grant' }),
      })
    );

    await expect(
      completeGoogleOAuthLogin({
        code: 'bad-code',
        codeVerifier: 'code-verifier',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects unverified Google emails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id_token: 'google-id-token' }),
      })
    );
    mockedJwtVerify.mockResolvedValue({
      payload: {
        email: 'user@example.com',
        email_verified: false,
      },
    });

    await expect(
      completeGoogleOAuthLogin({
        code: 'valid-code',
        codeVerifier: 'code-verifier',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
      })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('maps Google identity data into a local user lookup', async () => {
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id_token: 'google-id-token' }),
    });

    vi.stubGlobal('fetch', mockedFetch);
    mockedJwtVerify.mockResolvedValue({
      payload: {
        email: 'user@example.com',
        email_verified: true,
        given_name: 'Grace',
        family_name: 'Hopper',
        picture: 'https://example.com/avatar.png',
      },
    });
    mockedFindOrCreateByGoogle.mockResolvedValue({ id: 9, email: 'user@example.com' });

    const user = await completeGoogleOAuthLogin({
      code: 'valid-code',
      codeVerifier: 'code-verifier',
      redirectUri: 'http://localhost:3000/api/auth/google/callback',
    });
    const fetchCall = mockedFetch.mock.calls[0];
    const requestBody = fetchCall?.[1]?.body;

    expect(mockedFindOrCreateByGoogle).toHaveBeenCalledWith({
      email: 'user@example.com',
      first_name: 'Grace',
      last_name: 'Hopper',
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(requestBody instanceof URLSearchParams).toBe(true);
    expect(requestBody?.get('code_verifier')).toBe('code-verifier');
    expect(requestBody?.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
    expect(user).toEqual({ id: 9, email: 'user@example.com' });
  });

  it('fails when the runtime redirect URI is missing', async () => {
    await expect(
      completeGoogleOAuthLogin({ code: 'valid-code', codeVerifier: 'code-verifier', redirectUri: '' })
    ).rejects.toThrow('Google OAuth configuration is incomplete');
  });
});
