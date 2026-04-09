// Redirects legacy Google auth entrypoints to the PKCE start route using the incoming request origin.
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestOrigin } from '@/lib/utils/googleOAuth';

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/auth/google/start', resolveRequestOrigin(req)));
}
