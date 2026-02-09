import JSZip from 'jszip';
import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import type { Entry } from '@/lib/storage';
import { storage } from '@/lib/storage';
import { logError, logInfo } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeBackupEntry } from '@/lib/validation';

type BackupPayload = {
  journal: Entry[];
  learning: Entry[];
  resources: Entry[];
};

const INVALID_FORMAT_MESSAGE =
  'Invalid backup format: expected an object with journal, learning, and resources keys.';
const MISSING_KEYS_MESSAGE =
  'Backup must include journal, learning, and resources keys.';
const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BACKUP_FORM_BYTES = MAX_BACKUP_FILE_BYTES + 1024 * 1024;
// Limit restore size to avoid excessive load or long-running transactions.
const MAX_BACKUP_ENTRIES = 5000;
const INVALID_ENTRIES_MESSAGE = (count: number) =>
  `Backup contains ${count} invalid ${count === 1 ? 'entry' : 'entries'}.`;
const DUPLICATE_IDS_MESSAGE = 'Backup contains duplicate entry IDs.';
const MISSING_IDS_MESSAGE = 'Backup entries must include valid id values.';

const parseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const hasRequiredKeys = (payload: Record<string, unknown>) =>
  'journal' in payload && 'learning' in payload && 'resources' in payload;

const normalizeEntries = (type: 'journal' | 'learning' | 'resources', entries: unknown) => {
  if (!Array.isArray(entries)) {
    return { entries: [] as Entry[], invalidCount: 0, invalidFormat: true };
  }
  const normalized = entries
    .map(entry => normalizeBackupEntry(type, entry))
    .filter((entry): entry is Entry => Boolean(entry));
  return {
    entries: normalized,
    invalidCount: entries.length - normalized.length,
    invalidFormat: false,
  };
};

const validateEntryIds = (entries: Entry[]) => {
  const seen = new Set<string>();
  for (const entry of entries) {
    const id = entry.id?.trim();
    if (!id) {
      return MISSING_IDS_MESSAGE;
    }
    if (seen.has(id)) {
      return DUPLICATE_IDS_MESSAGE;
    }
    seen.add(id);
  }
  return null;
};

const normalizeBackupPayload = (payload: Record<string, unknown>) => {
  if (!hasRequiredKeys(payload)) {
    return { error: MISSING_KEYS_MESSAGE };
  }
  const journalResult = normalizeEntries('journal', payload.journal);
  const learningResult = normalizeEntries('learning', payload.learning);
  const resourcesResult = normalizeEntries('resources', payload.resources);
  if (journalResult.invalidFormat || learningResult.invalidFormat || resourcesResult.invalidFormat) {
    return { error: INVALID_FORMAT_MESSAGE };
  }
  const invalidCount =
    journalResult.invalidCount + learningResult.invalidCount + resourcesResult.invalidCount;
  if (invalidCount > 0) {
    return { error: INVALID_ENTRIES_MESSAGE(invalidCount) };
  }
  const idError =
    validateEntryIds(journalResult.entries) ??
    validateEntryIds(learningResult.entries) ??
    validateEntryIds(resourcesResult.entries);
  if (idError) {
    return { error: idError };
  }
  return {
    data: {
      journal: journalResult.entries,
      learning: learningResult.entries,
      resources: resourcesResult.entries,
    } satisfies BackupPayload,
  };
};

export async function GET(request: Request) {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.canWrite) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rateLimit = await checkRateLimit('backup:export', { limit: 10, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many backup exports. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter ?? 60),
        },
      }
    );
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
    await logAuditEvent('backup_exported', session, { format: 'zip' });
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="investing-garden-backup.zip"',
        'Cache-Control': 'no-store',
      },
    });
  }

  await logAuditEvent('backup_exported', session, { format: format ?? 'json' });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="investing-garden-backup.json"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  const session = await getAuthorizedSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.canWrite) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rateLimit = await checkRateLimit('backup:restore', { limit: 5, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many restore attempts. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter ?? 60),
        },
      }
    );
  }

  const contentType = request.headers.get('content-type') || '';
  let payload: Record<string, unknown> | null = null;

  if (contentType.includes('multipart/form-data')) {
    const contentLength = request.headers.get('content-length');
    const contentLengthBytes = contentLength ? Number(contentLength) : Number.NaN;
    if (Number.isFinite(contentLengthBytes) && contentLengthBytes > MAX_BACKUP_FORM_BYTES) {
      return NextResponse.json(
        { error: 'Backup file is too large (max 5MB)' },
        { status: 413 }
      );
    }
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Backup file is too large (max 5MB)' },
        { status: 413 }
      );
    }
    const buffer = await file.arrayBuffer();
    if (file.name.endsWith('.zip') || file.type === 'application/zip') {
      const zip = await JSZip.loadAsync(buffer);
      const journalJson = await zip.file('journal.json')?.async('string');
      const learningJson = await zip.file('learning.json')?.async('string');
      const resourcesJson = await zip.file('resources.json')?.async('string');
      const parsedJournal = journalJson ? parseJson(journalJson) : [];
      const parsedLearning = learningJson ? parseJson(learningJson) : [];
      const parsedResources = resourcesJson ? parseJson(resourcesJson) : [];
      if (
        (journalJson && parsedJournal === null) ||
        (learningJson && parsedLearning === null) ||
        (resourcesJson && parsedResources === null)
      ) {
        return NextResponse.json({ error: INVALID_FORMAT_MESSAGE }, { status: 400 });
      }
      payload = {
        journal: parsedJournal,
        learning: parsedLearning,
        resources: parsedResources,
      };
    } else {
      const text = new TextDecoder().decode(buffer);
      const parsed = parseJson(text);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        return NextResponse.json({ error: INVALID_FORMAT_MESSAGE }, { status: 400 });
      }
      payload = parsed as Record<string, unknown>;
    }
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: INVALID_FORMAT_MESSAGE }, { status: 400 });
    }
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return NextResponse.json({ error: INVALID_FORMAT_MESSAGE }, { status: 400 });
    }
    payload = body as Record<string, unknown>;
  }

  if (!payload) {
    return NextResponse.json({ error: 'Invalid backup payload' }, { status: 400 });
  }

  const normalized = normalizeBackupPayload(payload);
  if (!normalized.data) {
    return NextResponse.json({ error: normalized.error ?? INVALID_FORMAT_MESSAGE }, { status: 400 });
  }
  const totalEntries =
    normalized.data.journal.length +
    normalized.data.learning.length +
    normalized.data.resources.length;
  if (totalEntries > MAX_BACKUP_ENTRIES) {
    return NextResponse.json(
      { error: `Backup contains too many entries (max ${MAX_BACKUP_ENTRIES}).` },
      { status: 413 }
    );
  }

  try {
    const counts = await storage.replaceAllInTransaction(normalized.data);
    logInfo('backup_restore_completed', {
      journalCount: counts.journalCount,
      learningCount: counts.learningCount,
      resourceCount: counts.resourceCount,
    });
    await logAuditEvent('backup_restored', session, {
      journalCount: counts.journalCount,
      learningCount: counts.learningCount,
      resourceCount: counts.resourceCount,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('backup_restore_failed', error);
    return NextResponse.json(
      { error: 'Backup restore failed. Please review the server logs.' },
      { status: 500 }
    );
  }
}
