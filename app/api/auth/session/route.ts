import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';

export async function GET() {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: true, username: session.username });
}
