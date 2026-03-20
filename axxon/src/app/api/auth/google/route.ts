'use server';

import { NextResponse } from 'next/server';
import { buildGoogleOAuthAuthorizationUrl } from '@/lib/controllers/auth/authController';
import { handleApiError } from '@/lib/utils/apiErrors';

export async function GET() {
  try {
    return NextResponse.redirect(new URL(buildGoogleOAuthAuthorizationUrl()));
  } catch (error) {
    return handleApiError(
      error,
      '[GOOGLE_OAUTH_START_ERROR]',
      'Failed to start Google OAuth login'
    );
  }
}
