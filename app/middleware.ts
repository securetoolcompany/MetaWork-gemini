import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Use request.nextUrl to get the object, then pull pathname from it
  const { pathname } = request.nextUrl;
  
  // 1. Grab the session token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // 2. Redirect Authenticated users away from the landing page
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Protect the dashboard from unauthenticated users
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};