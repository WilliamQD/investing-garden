import { NextResponse } from 'next/server';

type Candle = {
  datetime: string;
  close: string;
};

const DEFAULT_CACHE_TTL_SECONDS = 240;
const MIN_CACHE_TTL_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 300;
const cacheTtlSeconds = Number(process.env.MARKET_CACHE_TTL_SECONDS);
const resolvedCacheSeconds = Number.isFinite(cacheTtlSeconds)
  ? Math.min(Math.max(cacheTtlSeconds, MIN_CACHE_TTL_SECONDS), MAX_CACHE_TTL_SECONDS)
  : DEFAULT_CACHE_TTL_SECONDS;
const CACHE_TTL_MS = resolvedCacheSeconds * 1000;
const CACHE_HEADER = `s-maxage=${resolvedCacheSeconds}, stale-while-revalidate=${resolvedCacheSeconds}`;
const historyCache = new Map<string, { data: { candles: Candle[]; updatedAt: string }; timestamp: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.trim().toUpperCase();
  const interval = searchParams.get('interval')?.trim() || '1day';
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  const cacheKey = `${ticker}-${interval}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { ticker, ...cached.data, cached: true },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Market data is unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        ticker
      )}&interval=${encodeURIComponent(interval)}&outputsize=30&apikey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await response.json();

    if (!response.ok || data?.status === 'error') {
      throw new Error(data?.message || 'Failed to fetch history');
    }

    const candles: Candle[] = Array.isArray(data?.values) ? data.values : [];
    const normalizedCandles = candles
      .map(candle => ({
        datetime: candle.datetime,
        close: candle.close,
      }))
      .reverse();
    const payload = {
      candles: normalizedCandles,
      updatedAt: new Date().toISOString(),
    };
    historyCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json(
      { ticker, ...payload },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  } catch (error) {
    console.error('Error fetching market history:', error);
    if (cached) {
      return NextResponse.json(
        { ticker, ...cached.data, stale: true },
        { headers: { 'Cache-Control': CACHE_HEADER } }
      );
    }
    return NextResponse.json(
      { error: 'Market history unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
