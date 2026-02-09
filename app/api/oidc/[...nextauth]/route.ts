import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions, isOidcConfigured } from '@/lib/auth-config';

const handler = NextAuth(authOptions);

const handleAuth = async (request: Request, context: unknown) => {
  if (!isOidcConfigured) {
    return NextResponse.json(
      { error: 'OIDC authentication is not configured.' },
      { status: 503 }
    );
  }
  return handler(request, context);
};

export { handleAuth as GET, handleAuth as POST };
