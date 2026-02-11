import { NextResponse } from 'next/server';

import { logError } from '@/lib/logger';
import { normalizeTicker } from '@/lib/validation';

type Candle = {
  datetime: string;
  close: string;
};

type HistoryPayload = {
  candles: Candle[];
  updatedAt: string;
};

type TwelveDataHistoryResponse = {
  status?: string;
  message?: string;
  values?: Candle[];
};

const ALLOWED_INTERVALS = new Set(['1day', '1week', '1month']);
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MIN_CACHE_TTL_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 300;
const PROVIDER_COOLDOWN_SECONDS = 60;
const cacheTtlSeconds = Number(process.env.MARKET_CACHE_TTL_SECONDS);
const resolvedCacheSeconds = Number.isFinite(cacheTtlSeconds)
  ? Math.min(Math.max(cacheTtlSeconds, MIN_CACHE_TTL_SECONDS), MAX_CACHE_TTL_SECONDS)
  : DEFAULT_CACHE_TTL_SECONDS;
const CACHE_TTL_MS = resolvedCacheSeconds * 1000;
const CACHE_HEADER = `s-maxage=${resolvedCacheSeconds}, stale-while-revalidate=${resolvedCacheSeconds}`;
const historyCache = new Map<string, { data: HistoryPayload; timestamp: number }>();
let providerBackoffUntilMs = 0;

const isRateLimitError = (response: Response, message?: string): boolean =>
  response.status === 429 || /run out of api credits|current limit/i.test(message ?? '');

const getProviderCooldownSeconds = (response: Response): number => {
  const retryAfterHeader = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return Math.min(retryAfterHeader, 300);
  }
  return PROVIDER_COOLDOWN_SECONDS;
};

const getBackoffSecondsRemaining = (): number =>
  Math.max(0, Math.ceil((providerBackoffUntilMs - Date.now()) / 1000));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const normalizedTicker = normalizeTicker(searchParams.get('ticker'));
  const interval = searchParams.get('interval')?.trim() || '1day';
  const forceRefresh = Boolean(searchParams.get('refresh'));
  if (!normalizedTicker) {
    return NextResponse.json(
      { error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' },
      { status: 400 }
    );
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: 'Interval must be one of: 1day, 1week, 1month' },
      { status: 400 }
    );
  }
  const cacheKey = `${normalizedTicker}-${interval}`;
  const cached = historyCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { ticker: normalizedTicker, ...cached.data, cached: true },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  }

  const backoffSeconds = getBackoffSecondsRemaining();
  if (backoffSeconds > 0) {
    if (cached) {
      return NextResponse.json(
        { ticker: normalizedTicker, ...cached.data, stale: true, providerLimited: true },
        { headers: { 'Cache-Control': CACHE_HEADER, 'Retry-After': String(backoffSeconds) } }
      );
    }
    return NextResponse.json(
      { error: 'Market history temporarily rate-limited', retryAfterSeconds: backoffSeconds },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(backoffSeconds) },
      }
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
        normalizedTicker
      )}&interval=${encodeURIComponent(interval)}&outputsize=30&apikey=${apiKey}`,
      { cache: 'no-store' }
    );
    let data: TwelveDataHistoryResponse | null = null;
    let parseError: unknown;

    try {
      data = (await response.json()) as TwelveDataHistoryResponse;
    } catch (err) {
      parseError = err;
    }

    if (!response.ok || data?.status === 'error') {
      if (isRateLimitError(response, data?.message)) {
        const cooldownSeconds = getProviderCooldownSeconds(response);
        providerBackoffUntilMs = Date.now() + cooldownSeconds * 1000;
      }
      const message =
        data?.message ||
        (!response.ok ? `Failed to fetch history (HTTP ${response.status})` : undefined) ||
        (parseError instanceof Error ? parseError.message : undefined) ||
        'Failed to fetch history';
      throw new Error(message);
    }

    const candles: Candle[] = Array.isArray(data?.values) ? data.values : [];
    const normalizedCandles = candles
      .map(candle => ({
        datetime: candle.datetime,
        close: candle.close,
      }))
      .reverse();
    const payload: HistoryPayload = {
      candles: normalizedCandles,
      updatedAt: new Date().toISOString(),
    };
    historyCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json(
      { ticker: normalizedTicker, ...payload },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  } catch (error) {
    logError('market_history_fetch_failed', error, { ticker: normalizedTicker, interval });
    const retryAfterSeconds = getBackoffSecondsRemaining();
    if (cached) {
      return NextResponse.json(
        {
          ticker: normalizedTicker,
          ...cached.data,
          stale: true,
          providerLimited: retryAfterSeconds > 0,
        },
        {
          headers: {
            'Cache-Control': CACHE_HEADER,
            ...(retryAfterSeconds > 0 ? { 'Retry-After': String(retryAfterSeconds) } : {}),
          },
        }
      );
    }
    return NextResponse.json(
      {
        error:
          retryAfterSeconds > 0 ? 'Market history temporarily rate-limited' : 'Market history unavailable',
        ...(retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          ...(retryAfterSeconds > 0 ? { 'Retry-After': String(retryAfterSeconds) } : {}),
        },
      }
    );
  }
}
