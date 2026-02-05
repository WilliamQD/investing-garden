import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { storage } from '@/lib/storage';

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
    const { title, content, outcome, emotion, tags, ticker } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const entry = await storage.create('journal', {
      title,
      content,
      outcome,
      emotion,
      tags,
      ticker,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
