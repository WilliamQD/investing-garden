import 'server-only';

import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';

type OwnerSession = NonNullable<Awaited<ReturnType<typeof getAuthorizedSession>>>;

type OwnerSessionResolution =
  | { ok: true; session: OwnerSession }
  | { ok: false; status: 401; error: 'Unauthorized' };

export async function resolveOwnerSession(
  loadSession: () => Promise<OwnerSession | null>
): Promise<OwnerSessionResolution> {
  const session = await loadSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }
  return { ok: true, session };
}

export async function requireOwnerSession() {
  const resolution = await resolveOwnerSession(getAuthorizedSession);
  if (!resolution.ok) {
    return {
      ...resolution,
      response: NextResponse.json({ error: resolution.error }, { status: resolution.status }),
    };
  }
  return resolution;
}
