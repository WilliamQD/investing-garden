import { NextResponse } from 'next/server';

import { logError } from '@/lib/logger';
import { normalizeTicker } from '@/lib/validation';

type HistoryResponse = {
  candles?: { close?: string }[];
};

const SIGNAL_SERVICE_URL =
  process.env.MARKET_SIGNAL_SERVICE_URL ?? 'http://signal-engine.default.svc.cluster.local:8000/v1/signals/momentum';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const normalizedTicker = normalizeTicker(searchParams.get('ticker'));

  if (!normalizedTicker) {
    return NextResponse.json(
      { error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' },
      { status: 400 }
    );
  }

  try {
    const historyResponse = await fetch(`${origin}/api/market/history?ticker=${encodeURIComponent(normalizedTicker)}`, {
      cache: 'no-store',
    });
    const historyData = (await historyResponse.json()) as HistoryResponse;

    if (!historyResponse.ok) {
      return NextResponse.json({ error: 'Unable to prepare market signal' }, { status: historyResponse.status });
    }

    const closes = Array.isArray(historyData.candles)
      ? historyData.candles
          .map(candle => Number.parseFloat(candle.close ?? ''))
          .filter(value => Number.isFinite(value))
      : [];

    if (closes.length < 15) {
      return NextResponse.json(
        { error: 'Not enough history to compute a momentum signal' },
        { status: 422 }
      );
    }

    const signalResponse = await fetch(SIGNAL_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        ticker: normalizedTicker,
        closes,
      }),
    });
    const signalData = await signalResponse.json();

    if (!signalResponse.ok) {
      return NextResponse.json(
        { error: signalData?.detail || 'Unable to compute market signal' },
        { status: signalResponse.status }
      );
    }

    return NextResponse.json(signalData, {
      headers: {
        'Cache-Control': 's-maxage=120, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    logError('market_signal_fetch_failed', error, { ticker: normalizedTicker });
    return NextResponse.json({ error: 'Market signal service unavailable' }, { status: 503 });
  }
}
