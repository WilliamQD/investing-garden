import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { deletePortfolioTrade, getPortfolioTrades, recalculateHolding, updatePortfolioTrade } from '@/lib/portfolio';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeTicker } from '@/lib/validation';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ACTIONS = new Set(['buy', 'sell']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('portfolio:trades:patch', {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many trade updates. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
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
    const updates: Record<string, unknown> = {};

    if (payload.ticker != null) {
      const ticker = normalizeTicker(payload.ticker);
      if (!ticker) {
        return NextResponse.json({ error: 'Invalid ticker.' }, { status: 400 });
      }
      updates.ticker = ticker;
    }
    if (payload.action != null) {
      const action = String(payload.action).toLowerCase();
      if (!VALID_ACTIONS.has(action)) {
        return NextResponse.json({ error: 'Action must be "buy" or "sell".' }, { status: 400 });
      }
      updates.action = action;
    }
    if (payload.quantity != null) {
      const quantity = Number(payload.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Quantity must be a positive number.' }, { status: 400 });
      }
      updates.quantity = quantity;
    }
    if (payload.price != null) {
      const price = Number(payload.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Price must be a non-negative number.' }, { status: 400 });
      }
      updates.price = price;
    }
    if (payload.tradeDate != null) {
      const tradeDate = String(payload.tradeDate);
      if (!ISO_DATE_PATTERN.test(tradeDate)) {
        return NextResponse.json({ error: 'Trade date must be YYYY-MM-DD.' }, { status: 400 });
      }
      updates.tradeDate = tradeDate;
    }
    if ('gainLoss' in payload) {
      if (payload.gainLoss != null && payload.gainLoss !== '') {
        const parsed = Number(payload.gainLoss);
        if (!Number.isFinite(parsed)) {
          return NextResponse.json({ error: 'Gain/loss must be a number.' }, { status: 400 });
        }
        updates.gainLoss = parsed;
      } else {
        updates.gainLoss = null;
      }
    }
    if ('notes' in payload) {
      updates.notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 500) || null : null;
    }

    // Get old trade to know which tickers to recalculate
    const trades = await getPortfolioTrades();
    const oldTrade = trades.find(t => t.id === id);
    if (!oldTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const updated = await updatePortfolioTrade(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Recalculate holdings for affected tickers
    await recalculateHolding(oldTrade.ticker);
    if (updates.ticker && updates.ticker !== oldTrade.ticker) {
      await recalculateHolding(updates.ticker as string);
    }

    await logAuditEvent('portfolio_trade_updated', session, {
      tradeId: id,
      ticker: updated.ticker,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating trade:', error);
    return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimit = await checkRateLimit('portfolio:trades:delete', {
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
    // Fetch the trade's ticker before deleting so we can recalculate the holding
    const trades = await getPortfolioTrades();
    const trade = trades.find(t => t.id === id);
    const success = await deletePortfolioTrade(id);
    if (!success) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }
    // Recalculate holding from remaining trades
    if (trade) {
      await recalculateHolding(trade.ticker);
    }
    await logAuditEvent('portfolio_trade_removed', session, { tradeId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 });
  }
}
