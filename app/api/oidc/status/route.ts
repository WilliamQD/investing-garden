import { NextResponse } from 'next/server';

import { isOidcConfigured } from '@/lib/auth-config';

export function GET() {
  return NextResponse.json({ enabled: isOidcConfigured });
}
