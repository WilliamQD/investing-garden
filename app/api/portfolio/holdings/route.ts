import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { addHolding, addHoldings, getHoldings } from '@/lib/portfolio';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeLabel, normalizeTicker } from '@/lib/validation';

const MAX_BULK_HOLDINGS = 50;
const parseOptionalNumber = (
  value: unknown,
  fieldName: string
): { value: number | null; error?: string } => {
  if (value == null || value === '') {
    return { value: null };
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { value: null, error: `${fieldName} must be a non-negative number.` };
  }
  return { value: numeric };
};

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
    const rateLimit = await checkRateLimit('portfolio:holdings:post', {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many holding updates. Try again shortly.' },
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
    const payload = body as Record<string, unknown>;
    const bulk = payload.holdings;
    if (Array.isArray(bulk)) {
      if (!bulk.length) {
        return NextResponse.json({ error: 'Provide at least one holding to import.' }, { status: 400 });
      }
      if (bulk.length > MAX_BULK_HOLDINGS) {
        return NextResponse.json({ error: `Holdings imports are limited to ${MAX_BULK_HOLDINGS} rows.` }, { status: 400 });
      }
      const normalized: {
        ticker: string;
        label?: string;
        quantity?: number | null;
        purchasePrice?: number | null;
      }[] = [];
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
        const quantityResult = parseOptionalNumber(record.quantity, 'Quantity');
        if (quantityResult.error) {
          errors.push({ index, message: quantityResult.error });
          return;
        }
        const purchaseResult = parseOptionalNumber(record.purchasePrice, 'Purchase price');
        if (purchaseResult.error) {
          errors.push({ index, message: purchaseResult.error });
          return;
        }
        normalized.push({
          ticker,
          label,
          quantity: quantityResult.value,
          purchasePrice: purchaseResult.value,
        });
        seen.add(ticker);
      });
      if (errors.length) {
        return NextResponse.json({ error: 'Holdings import contains invalid rows.', details: errors }, { status: 400 });
      }
      const holdings = await addHoldings(normalized);
      await logAuditEvent('portfolio_holdings_bulk_imported', session, {
        imported: holdings.length,
        skipped: bulk.length - normalized.length,
      });
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
    const quantityResult = parseOptionalNumber(payload.quantity, 'Quantity');
    if (quantityResult.error) {
      return NextResponse.json({ error: quantityResult.error }, { status: 400 });
    }
    const purchaseResult = parseOptionalNumber(payload.purchasePrice, 'Purchase price');
    if (purchaseResult.error) {
      return NextResponse.json({ error: purchaseResult.error }, { status: 400 });
    }
    const holding = await addHolding(ticker, label, quantityResult.value, purchaseResult.value);
    await logAuditEvent('portfolio_holding_added', session, {
      holdingId: holding.id,
      ticker: holding.ticker,
    });
    return NextResponse.json(holding, { status: 201 });
  } catch (error) {
    console.error('Error adding holding:', error);
    return NextResponse.json({ error: 'Failed to add holding' }, { status: 500 });
  }
}
