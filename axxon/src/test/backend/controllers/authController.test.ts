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
  buildGoogleOAuthAuthorizationUrl,
  completeGoogleOAuthLogin,
} from '@/lib/controllers/auth/authController';

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.NEXT_PUBLIC_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  it('builds the Google authorization URL from runtime config', () => {
    const authUrl = new URL(buildGoogleOAuthAuthorizationUrl());

    expect(`${authUrl.origin}${authUrl.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
    expect(authUrl.searchParams.get('client_id')).toBe('google-client-id');
    expect(authUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/google/callback'
    );
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('scope')).toBe('openid email profile');
  });

  it('prefers GOOGLE_REDIRECT_URI when it is set', () => {
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback/server';

    const authUrl = new URL(buildGoogleOAuthAuthorizationUrl());

    expect(authUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/google/callback/server'
    );
  });

  it('rejects missing authorization codes', async () => {
    await expect(completeGoogleOAuthLogin({ code: '' })).rejects.toBeInstanceOf(
      BadRequestError
    );
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
      completeGoogleOAuthLogin({ code: 'bad-code' })
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
      completeGoogleOAuthLogin({ code: 'valid-code' })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('maps Google identity data into a local user lookup', async () => {
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
        email_verified: true,
        given_name: 'Grace',
        family_name: 'Hopper',
        picture: 'https://example.com/avatar.png',
      },
    });
    mockedFindOrCreateByGoogle.mockResolvedValue({ id: 9, email: 'user@example.com' });

    const user = await completeGoogleOAuthLogin({ code: 'valid-code' });

    expect(mockedFindOrCreateByGoogle).toHaveBeenCalledWith({
      email: 'user@example.com',
      first_name: 'Grace',
      last_name: 'Hopper',
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(user).toEqual({ id: 9, email: 'user@example.com' });
  });

  it('fails when the runtime redirect URI is missing', () => {
    delete process.env.NEXT_PUBLIC_REDIRECT_URI;

    expect(() => buildGoogleOAuthAuthorizationUrl()).toThrow(
      'Google OAuth configuration is incomplete'
    );
  });
});
