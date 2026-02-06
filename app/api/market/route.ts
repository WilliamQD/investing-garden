import { NextResponse } from 'next/server';

type QuotePayload = {
  price: number;
  currency?: string;
  changePercent?: number;
  updatedAt: string;
};

const DEFAULT_CACHE_TTL_SECONDS = 180;
const cacheTtlSeconds = Number(process.env.MARKET_CACHE_TTL_SECONDS);
const CACHE_TTL_MS = (Number.isFinite(cacheTtlSeconds) ? cacheTtlSeconds : DEFAULT_CACHE_TTL_SECONDS) * 1000;
const quoteCache = new Map<string, { data: QuotePayload; timestamp: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ticker, ...cached.data, cached: true });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Market data is unavailable' }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await response.json();
    if (!response.ok || data?.status === 'error') {
      throw new Error(data?.message || 'Failed to fetch');
    }

    const price = Number.parseFloat(data.price);
    if (!Number.isFinite(price)) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    const changePercent = Number.parseFloat(data.percent_change);
    const payload: QuotePayload = {
      price,
      currency: data.currency,
      changePercent: Number.isFinite(changePercent) ? changePercent : undefined,
      updatedAt: data.timestamp
        ? new Date(Number(data.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    };
    quoteCache.set(ticker, { data: payload, timestamp: Date.now() });
    return NextResponse.json({ ticker, ...payload });
  } catch (error) {
    console.error('Error fetching market data:', error);
    if (cached) {
      return NextResponse.json({ ticker, ...cached.data, stale: true });
    }
    return NextResponse.json({ error: 'Market data unavailable' }, { status: 503 });
  }
}
