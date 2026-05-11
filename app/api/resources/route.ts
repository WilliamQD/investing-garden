import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { storage } from '@/lib/storage';
import { normalizeEntryInput } from '@/lib/validation';

export async function GET() {
  try {
    const entries = await storage.getAll('resources');
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit('resources:create', { limit: 30, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many resource updates. Try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    const normalized = normalizeEntryInput('resources', body as Record<string, unknown>);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.error ?? 'Invalid entry payload' }, { status: 400 });
    }

    const entry = await storage.create('resources', normalized.data);
    await logAuditEvent('resource_entry_created', session, { entryId: entry.id });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating resource entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
