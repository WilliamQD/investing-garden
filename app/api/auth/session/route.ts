import { NextResponse } from 'next/server';

import { getAuthorizedSession, getSessionCookieName, getSessionRotationCookie } from '@/lib/auth';

export async function GET() {
  const session = await getAuthorizedSession();
  if (!session) {
    const response = NextResponse.json({ isAuthenticated: false, canWrite: false });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Vary', 'Cookie');
    return response;
  }
  const response = NextResponse.json({
    isAuthenticated: true,
    canWrite: session.canWrite,
    username: session.username,
  });
  const rotatedCookie = getSessionRotationCookie(session);
  if (rotatedCookie) {
    response.cookies.set(getSessionCookieName(), rotatedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}
