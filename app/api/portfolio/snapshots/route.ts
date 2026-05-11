import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getPortfolioSnapshots, upsertPortfolioSnapshot } from '@/lib/portfolio';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeIsoDate } from '@/lib/validation';

export async function GET() {
  try {
    const snapshots = await getPortfolioSnapshots();
    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('Error fetching portfolio snapshots:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit('portfolio:snapshots:post', {
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many snapshot updates. Try again shortly.' },
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
    const rawDate = (body as Record<string, unknown>).date;
    const normalizedDate = normalizeIsoDate(rawDate);
    const numericValue = Number((body as Record<string, unknown>).value);
    if (!normalizedDate || !Number.isFinite(numericValue) || numericValue < 0) {
      return NextResponse.json(
        { error: 'Date (YYYY-MM-DD) and a non-negative numeric value are required' },
        { status: 400 }
      );
    }
    const snapshot = await upsertPortfolioSnapshot(normalizedDate, numericValue);
    await logAuditEvent('portfolio_snapshot_upserted', session, {
      date: normalizedDate,
      value: numericValue,
    });
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('Error saving portfolio snapshot:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}
