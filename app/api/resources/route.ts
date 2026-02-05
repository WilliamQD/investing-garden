import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

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
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { title, content, url, sourceType, tags } = body;

    if (!title || !content || !url || !url.trim()) {
      return NextResponse.json(
        { error: 'Title, content, and URL are required' },
        { status: 400 }
      );
    }

    const entry = await storage.create('resources', { title, content, url, sourceType, tags });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating resource entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
