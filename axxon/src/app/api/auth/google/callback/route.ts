'use server';

import { NextRequest, NextResponse } from 'next/server';
import { completeGoogleOAuthLogin } from '@/lib/controllers/auth/authController';
import { BadRequestError, handleApiError } from '@/lib/utils/apiErrors';
import { issueSessionCookie } from '@/lib/utils/auth';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      throw new BadRequestError('Authorization code not provided');
    }

    const user = await completeGoogleOAuthLogin({ code });

    // Set cookie and redirect
    const response = NextResponse.redirect(
      new URL('/dashboard', process.env.NEXT_PUBLIC_HOSTNAME || req.nextUrl.origin)
    );
    await issueSessionCookie(response, {
      id: user.id,
      email: user.email,
      name: user.first_name,
    });

    return response;
  } catch (error) {
    return handleApiError(
      error,
      '[GOOGLE_OAUTH_CALLBACK_ERROR]',
      'Failed to complete Google OAuth login'
    );
  }
}
