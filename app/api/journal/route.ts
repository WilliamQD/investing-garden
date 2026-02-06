import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { normalizeEntryInput } from '@/lib/validation';

export async function GET() {
  try {
    const entries = await storage.getAll('journal');
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }
    const normalized = normalizeEntryInput('journal', body as Record<string, unknown>);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.error ?? 'Invalid entry payload' }, { status: 400 });
    }

    const entry = await storage.create('journal', normalized.data);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
