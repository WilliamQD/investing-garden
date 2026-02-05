import JSZip from 'jszip';
import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import type { Entry } from '@/lib/storage';
import { storage } from '@/lib/storage';

type BackupPayload = {
  journal: Entry[];
  learning: Entry[];
  resources: Entry[];
};

const normalizePayload = (payload: Record<string, unknown>): BackupPayload => ({
  journal: (payload.journal as Entry[]) ?? [],
  learning: (payload.learning as Entry[]) ?? [],
  resources: (payload.resources as Entry[]) ?? [],
});

export async function GET(request: Request) {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const journal = await storage.getAll('journal');
  const learning = await storage.getAll('learning');
  const resources = await storage.getAll('resources');
  const payload = { journal, learning, resources };
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (format === 'zip') {
    const zip = new JSZip();
    zip.file('journal.json', JSON.stringify(journal, null, 2));
    zip.file('learning.json', JSON.stringify(learning, null, 2));
    zip.file('resources.json', JSON.stringify(resources, null, 2));
    const content = await zip.generateAsync({ type: 'uint8array' });
    const arrayBuffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    ) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="investing-garden-backup.zip"',
      },
    });
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="investing-garden-backup.json"',
    },
  });
}

export async function POST(request: Request) {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  let payload: BackupPayload | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    if (file.name.endsWith('.zip') || file.type === 'application/zip') {
      const zip = await JSZip.loadAsync(buffer);
      const journalJson = await zip.file('journal.json')?.async('string');
      const learningJson = await zip.file('learning.json')?.async('string');
      const resourcesJson = await zip.file('resources.json')?.async('string');
      payload = {
        journal: journalJson ? JSON.parse(journalJson) : [],
        learning: learningJson ? JSON.parse(learningJson) : [],
        resources: resourcesJson ? JSON.parse(resourcesJson) : [],
      };
    } else {
      const text = new TextDecoder().decode(buffer);
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
        return NextResponse.json({ error: 'Backup must include journal, learning, and resources keys.' }, { status: 400 });
      }
      payload = normalizePayload(parsed as Record<string, unknown>);
    }
  } else {
    const body = await request.json();
    if (Array.isArray(body) || !body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Backup must include journal, learning, and resources keys.' }, { status: 400 });
    }
    payload = normalizePayload(body as Record<string, unknown>);
  }

  if (!payload) {
    return NextResponse.json({ error: 'Invalid backup payload' }, { status: 400 });
  }

  await storage.replaceAll('journal', payload.journal);
  await storage.replaceAll('learning', payload.learning);
  await storage.replaceAll('resources', payload.resources);

  return NextResponse.json({ success: true });
}
