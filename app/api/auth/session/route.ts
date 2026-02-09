import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';

export async function GET() {
  const session = await getAuthorizedSession();
  if (!session) {
    const response = NextResponse.json({ isAdmin: false });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Vary', 'Cookie');
    return response;
  }
  const response = NextResponse.json({ isAdmin: true, username: session.username });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
}
