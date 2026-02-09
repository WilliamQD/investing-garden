import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { storage } from '@/lib/storage';
import { normalizeEntryInput } from '@/lib/validation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const entry = await storage.getById('resources', id);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('resources:update', { limit: 40, windowMs: 60_000 });
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

    const entry = await storage.update('resources', id, normalized.data);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    await logAuditEvent('resource_entry_updated', session, { entryId: entry.id });
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error updating resource entry:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('resources:delete', { limit: 30, windowMs: 60_000 });
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
    const success = await storage.delete('resources', id);
    if (!success) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    await logAuditEvent('resource_entry_deleted', session, { entryId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
