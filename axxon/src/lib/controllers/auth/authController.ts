'use server';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { Users } from '@/lib/models/users';
import type { User } from '@/lib/types/users';
import { BadRequestError, UnauthorizedError } from '@/lib/utils/apiErrors';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type GoogleTokenResponse = {
  error?: string;
  error_description?: string;
  id_token?: string;
};

type GoogleIdTokenPayload = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type CompleteGoogleOAuthLoginInput = {
  code: string;
};

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth configuration is incomplete');
  }

  return { clientId, clientSecret, redirectUri };
}

// Exchanges the Google authorization code and resolves the local user.
export async function completeGoogleOAuthLogin({
  code,
}: CompleteGoogleOAuthLoginInput): Promise<User> {
  if (!code) {
    throw new BadRequestError('Authorization code not provided');
  }

  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  let tokenData: GoogleTokenResponse;
  try {
    tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  } catch {
    throw new BadRequestError('Failed to exchange token');
  }

  if (!tokenRes.ok || tokenData.error || !tokenData.id_token) {
    throw new BadRequestError('Failed to exchange token');
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(tokenData.id_token, googleJwks, {
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    }));
  } catch {
    throw new UnauthorizedError('Google identity token could not be verified');
  }

  const decoded = payload as GoogleIdTokenPayload;
  if (!decoded.email || decoded.email_verified !== true) {
    throw new UnauthorizedError('Google account email could not be verified');
  }

  return Users.findOrCreateByGoogle({
    email: decoded.email,
    first_name: decoded.given_name ?? '',
    last_name: decoded.family_name ?? '',
    avatar_url: decoded.picture ?? '',
  });
}
