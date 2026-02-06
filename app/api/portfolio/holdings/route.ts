import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { addHolding, getHoldings } from '@/lib/portfolio';
import { normalizeLabel, normalizeTicker } from '@/lib/validation';

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
    const ticker = normalizeTicker((body as Record<string, unknown>).ticker);
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' }, { status: 400 });
    }
    const label = normalizeLabel((body as Record<string, unknown>).label);
    const holding = await addHolding(ticker, label);
    return NextResponse.json(holding, { status: 201 });
  } catch (error) {
    console.error('Error adding holding:', error);
    return NextResponse.json({ error: 'Failed to add holding' }, { status: 500 });
  }
}
