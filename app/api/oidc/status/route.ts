import { NextResponse } from 'next/server';

import { isOidcConfigured } from '@/lib/auth-config';

export async function GET() {
  return NextResponse.json({ enabled: isOidcConfigured });
}
