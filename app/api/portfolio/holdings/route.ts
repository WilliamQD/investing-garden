import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { addHolding, addHoldings, getHoldings } from '@/lib/portfolio';
import { normalizeLabel, normalizeTicker } from '@/lib/validation';

const MAX_BULK_HOLDINGS = 50;

export async function GET() {
  try {
    const holdings = await getHoldings();
    return NextResponse.json(holdings);
  } catch (error) {
    console.error('Error fetching holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
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
    const payload = body as Record<string, unknown>;
    const bulk = payload.holdings;
    if (Array.isArray(bulk)) {
      if (!bulk.length) {
        return NextResponse.json({ error: 'Provide at least one holding to import.' }, { status: 400 });
      }
      if (bulk.length > MAX_BULK_HOLDINGS) {
        return NextResponse.json({ error: `Holdings imports are limited to ${MAX_BULK_HOLDINGS} rows.` }, { status: 400 });
      }
      const normalized: { ticker: string; label?: string }[] = [];
      const errors: { index: number; message: string }[] = [];
      const seen = new Set<string>();
      bulk.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push({ index, message: 'Invalid row format.' });
          return;
        }
        const record = item as Record<string, unknown>;
        const ticker = normalizeTicker(record.ticker);
        if (!ticker) {
          errors.push({ index, message: 'Ticker must be 1-10 characters (letters, numbers, . or -).' });
          return;
        }
        if (seen.has(ticker)) {
          return;
        }
        const label = normalizeLabel(record.label);
        normalized.push({ ticker, label });
        seen.add(ticker);
      });
      if (errors.length) {
        return NextResponse.json({ error: 'Holdings import contains invalid rows.', details: errors }, { status: 400 });
      }
      const holdings = await addHoldings(normalized);
      return NextResponse.json(
        { holdings, skipped: bulk.length - normalized.length },
        { status: 201 }
      );
    }
    const ticker = normalizeTicker(payload.ticker);
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' }, { status: 400 });
    }
    const label = normalizeLabel(payload.label);
    const holding = await addHolding(ticker, label);
    return NextResponse.json(holding, { status: 201 });
  } catch (error) {
    console.error('Error adding holding:', error);
    return NextResponse.json({ error: 'Failed to add holding' }, { status: 500 });
  }
}
