import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';
import { UnauthorizedError } from '@/lib/utils/apiErrors';

const SESSION_COOKIE_NAME = 'token';
const SESSION_DURATION = '7d';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type RequestWithCookies = Pick<NextRequest, 'cookies'>;

type SessionClaims = JWTPayload & {
  email?: string;
  name?: string;
  id?: number | string;
};

export type SessionUser = {
  userId: number;
  email?: string;
  name?: string;
};

export type SessionCookiePayload = {
  id: number;
  email: string;
  name?: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
}

function normalizeSessionPayload(payload: SessionClaims): SessionUser {
  const rawUserId = payload.sub ?? payload.id;
  const userId = Number(rawUserId);

  if (!Number.isFinite(userId)) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  return {
    userId,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

export async function signSessionToken(payload: SessionCookiePayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });

    return normalizeSessionPayload(payload as SessionClaims);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function getSessionTokenFromRequest(req: RequestWithCookies): string | null {
  return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function getSessionTokenFromCookieHeader(cookieHeader?: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');

    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export async function getSessionFromRequest(req: RequestWithCookies): Promise<SessionUser | null> {
  const token = getSessionTokenFromRequest(req);

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession(req: RequestWithCookies): Promise<SessionUser> {
  const session = await getSessionFromRequest(req);

  if (!session) {
    throw new UnauthorizedError('Unauthorized');
  }

  return session;
}

export async function issueSessionCookie(
  response: NextResponse,
  payload: SessionCookiePayload
): Promise<string> {
  const token = await signSessionToken(payload);

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return token;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
