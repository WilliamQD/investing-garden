import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { addPortfolioTrade, getHoldings, getPortfolioTrades, recalculateHolding } from '@/lib/portfolio';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireOwnerSession } from '@/lib/route-auth';
import { normalizeTicker } from '@/lib/validation';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ACTIONS = new Set(['buy', 'sell']);

export async function GET() {
  try {
    const owner = await requireOwnerSession();
    if (!owner.ok) return owner.response;
    const trades = await getPortfolioTrades();
    return NextResponse.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit('portfolio:trades:post', {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many trade updates. Try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
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
    const ticker = normalizeTicker(payload.ticker);
    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' },
        { status: 400 }
      );
    }
    const action = String(payload.action ?? '').toLowerCase();
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Action must be "buy" or "sell".' }, { status: 400 });
    }
    const quantity = Number(payload.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number.' }, { status: 400 });
    }
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Price must be a non-negative number.' }, { status: 400 });
    }
    const tradeDate = String(payload.tradeDate ?? '');
    if (!ISO_DATE_PATTERN.test(tradeDate)) {
      return NextResponse.json({ error: 'Trade date must be YYYY-MM-DD.' }, { status: 400 });
    }
    // For sell trades, validate sufficient shares and auto-calculate gain/loss
    let gainLoss: number | null = null;
    if (action === 'sell') {
      const holdings = await getHoldings();
      const holding = holdings.find(h => h.ticker === ticker);
      const heldQty = holding?.quantity ?? 0;
      if (heldQty < quantity) {
        return NextResponse.json(
          { error: `Cannot sell ${quantity} shares — only ${heldQty} held.` },
          { status: 400 }
        );
      }
      // Auto-calculate gain/loss from holding's average cost
      const avgCost = holding?.purchasePrice ?? 0;
      gainLoss = (price - avgCost) * quantity;
    }
    // Allow explicit gainLoss override if provided (for manual/historical entries)
    const gainLossRaw = payload.gainLoss;
    if (gainLossRaw != null && gainLossRaw !== '') {
      const parsed = Number(gainLossRaw);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: 'Gain/loss must be a number.' }, { status: 400 });
      }
      gainLoss = parsed;
    }
    const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 500) || null : null;
    const trade = await addPortfolioTrade({
      ticker,
      action: action as 'buy' | 'sell',
      quantity,
      price,
      tradeDate,
      gainLoss,
      notes,
    });
    // Recalculate the holding from full trade history
    await recalculateHolding(ticker);
    await logAuditEvent('portfolio_trade_added', session, {
      tradeId: trade.id,
      ticker: trade.ticker,
      action: trade.action,
    });
    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    console.error('Error adding trade:', error);
    return NextResponse.json({ error: 'Failed to add trade' }, { status: 500 });
  }
}
