import { NextResponse } from 'next/server';

import {
  clearLoginAttempts,
  createSessionCookieValue,
  getSessionCookieName,
  isLoginRateLimited,
  registerFailedLogin,
  verifyCredentials,
} from '@/lib/auth';

export async function POST(request: Request) {
  if (await isLoginRateLimited()) {
    return NextResponse.json(
      { error: 'Too many failed login attempts. Try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const username = typeof (body as { username?: unknown }).username === 'string'
    ? (body as { username: string }).username.trim()
    : '';
  const password = typeof (body as { password?: unknown }).password === 'string'
    ? (body as { password: string }).password
    : '';

  if (!verifyCredentials(username, password)) {
    await registerFailedLogin();
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const cookieValue = createSessionCookieValue(username);
  if (!cookieValue) {
    return NextResponse.json(
      { error: 'Server auth session is not configured.' },
      { status: 503 }
    );
  }

  await clearLoginAttempts();

  const response = NextResponse.json({ success: true, username });
  response.cookies.set(getSessionCookieName(), cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
