import { NextResponse } from 'next/server';

import { logError } from '@/lib/logger';
import { parseNumeric, resolveQuoteUpdatedAt } from '@/lib/market';
import { normalizeTicker } from '@/lib/validation';

type QuotePayload = {
  price: number;
  currency?: string;
  changePercent?: number;
  updatedAt: string;
};

type TwelveDataQuote = {
  status?: string;
  message?: string;
  price?: string | number;
  close?: string | number;
  previous_close?: string | number;
  currency?: string;
  percent_change?: string | number;
  timestamp?: string | number;
  datetime?: string;
};

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
const quoteCache = new Map<string, { data: QuotePayload; timestamp: number }>();
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

const parseNumeric = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveUpdatedAt = (data: TwelveDataQuote): string => {
  if (typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)) {
    return new Date(data.timestamp * 1000).toISOString();
  }
  if (typeof data.timestamp === 'string' && /^\d+(\.\d+)?$/.test(data.timestamp)) {
    return new Date(Number.parseFloat(data.timestamp) * 1000).toISOString();
  }
  if (typeof data.datetime === 'string') {
    const parsed = new Date(data.datetime.replace(' ', 'T'));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const normalizedTicker = normalizeTicker(searchParams.get('ticker'));
  const forceRefresh = Boolean(searchParams.get('refresh'));
  if (!normalizedTicker) {
    return NextResponse.json(
      { error: 'Ticker must be 1-10 characters (letters, numbers, . or -)' },
      { status: 400 }
    );
  }
  const cached = quoteCache.get(normalizedTicker);
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
      { error: 'Market data temporarily rate-limited', retryAfterSeconds: backoffSeconds },
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
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(normalizedTicker)}&apikey=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = (await response.json()) as TwelveDataQuote;
    if (!response.ok || data?.status === 'error') {
      if (isRateLimitError(response, data?.message)) {
        const cooldownSeconds = getProviderCooldownSeconds(response);
        providerBackoffUntilMs = Date.now() + cooldownSeconds * 1000;
      }
      throw new Error(data?.message || 'Failed to fetch');
    }

    const resolvedPrice =
      parseNumeric(data.price) ??
      parseNumeric(data.close) ??
      parseNumeric(data.previous_close);
    if (resolvedPrice == null) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    const payload: QuotePayload = {
      price: resolvedPrice,
      currency: data.currency,
      changePercent: parseNumeric(data.percent_change),
      updatedAt: resolveQuoteUpdatedAt(data),
    };
    quoteCache.set(normalizedTicker, { data: payload, timestamp: Date.now() });
    return NextResponse.json(
      { ticker: normalizedTicker, ...payload },
      { headers: { 'Cache-Control': CACHE_HEADER } }
    );
  } catch (error) {
    logError('market_quote_fetch_failed', error, { ticker: normalizedTicker });
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
        error: retryAfterSeconds > 0 ? 'Market data temporarily rate-limited' : 'Market data unavailable',
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
