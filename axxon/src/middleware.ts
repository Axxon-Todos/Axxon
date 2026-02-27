// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionTokenFromRequest, verifySessionToken } from '@/lib/utils/auth';

const PUBLIC_API_PATHS = new Set(['/api/auth', '/api/auth/google/callback']);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isRoot = pathname === '/';
  const isProtectedPage = pathname.startsWith('/dashboard');
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicApiRoute = PUBLIC_API_PATHS.has(pathname);
  const token = getSessionTokenFromRequest(req);
  let isAuthenticated = false;

  try {
    if (token) {
      await verifySessionToken(token);
      isAuthenticated = true;
    }
  } catch (err) {
    console.log('JWT verification failed in middleware:', err);
    isAuthenticated = false;
  }

  if (isRoot) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  }

  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  if (isApiRoute && !isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isProtectedPage && !isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/api/:path*'],
};
