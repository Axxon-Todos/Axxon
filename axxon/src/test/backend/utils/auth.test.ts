import { beforeEach, describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import { UnauthorizedError } from '@/lib/utils/apiErrors';
import {
  getSessionTokenFromCookieHeader,
  issueSessionCookie,
  requireSession,
  signSessionToken,
  verifySessionToken,
} from '@/lib/utils/auth';

describe('auth utils', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  it('signs and verifies session tokens', async () => {
    const token = await signSessionToken({
      id: 42,
      email: 'user@example.com',
      name: 'Test User',
    });

    const session = await verifySessionToken(token);

    expect(session).toEqual({
      userId: 42,
      email: 'user@example.com',
      name: 'Test User',
    });
  });

  it('extracts the session token from a raw cookie header', () => {
    expect(
      getSessionTokenFromCookieHeader('other=value; token=abc123%3D; more=data')
    ).toBe('abc123=');
  });

  it('throws unauthorized for invalid tokens', async () => {
    await expect(verifySessionToken('not-a-real-token')).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it('requires a valid session cookie', async () => {
    await expect(
      requireSession({
        cookies: {
          get: () => undefined,
        },
      } as never)
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('issues a session cookie on the response', async () => {
    const response = NextResponse.json({ ok: true });

    const token = await issueSessionCookie(response, {
      id: 7,
      email: 'cookie@example.com',
      name: 'Cookie User',
    });

    const setCookieHeader = response.headers.get('set-cookie');

    expect(token).toBeTypeOf('string');
    expect(setCookieHeader).toContain('token=');
    expect(setCookieHeader).toContain('HttpOnly');
  });
});
