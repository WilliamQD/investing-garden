'use client';

import { useEffect, useState } from 'react';

interface MarketPriceProps {
  ticker: string;
  refreshToken?: number;
  onData?: (ticker: string, data: MarketData) => void;
}

export interface MarketData {
  price: number;
  currency?: string;
  changePercent?: number;
  updatedAt?: string;
  stale?: boolean;
  cached?: boolean;
}

const DEFAULT_CACHE_TTL = 180_000;
const MIN_CACHE_TTL = 60_000;
const MAX_CACHE_TTL = 300_000;
const cacheEnvValue = Number(process.env.NEXT_PUBLIC_MARKET_CACHE_TTL_MS);
const CACHE_TTL = Number.isFinite(cacheEnvValue)
  ? Math.min(Math.max(cacheEnvValue, MIN_CACHE_TTL), MAX_CACHE_TTL)
  : DEFAULT_CACHE_TTL;
const marketCache = new Map<string, { data: MarketData; timestamp: number }>();

export default function MarketPrice({ ticker, refreshToken, onData }: MarketPriceProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const normalizedTicker = ticker.trim().toUpperCase();
    const cached = marketCache.get(normalizedTicker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setError('');
      onData?.(normalizedTicker, cached.data);
      if (!refreshToken) {
        return () => {
          isActive = false;
        };
      }
    }
    const loadPrice = async () => {
      try {
        setError('');
        const refreshQuery = refreshToken ? `&refresh=${refreshToken}` : '';
        const response = await fetch(
          `/api/market?ticker=${encodeURIComponent(normalizedTicker)}${refreshQuery}`,
          refreshToken ? { cache: 'no-store' } : undefined
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || 'Failed to fetch market data');
        }
        const price = Number(result.price);
        if (!Number.isFinite(price)) {
          throw new Error('Invalid price data');
        }
        const changePercent = Number(result.changePercent);
        if (isActive) {
          const nextData = {
            price,
            currency: typeof result.currency === 'string' ? result.currency : undefined,
            changePercent: Number.isFinite(changePercent) ? changePercent : undefined,
            updatedAt: typeof result.updatedAt === 'string' ? result.updatedAt : undefined,
            stale: Boolean(result.stale),
            cached: Boolean(result.cached),
          };
          marketCache.set(normalizedTicker, { data: nextData, timestamp: Date.now() });
          setData(nextData);
          onData?.(normalizedTicker, nextData);
        }
      } catch (error) {
        console.error('Market price fetch failed', error);
        if (isActive) {
          const fallback = marketCache.get(normalizedTicker);
          if (fallback) {
            const nextData = { ...fallback.data, stale: true };
            marketCache.set(normalizedTicker, { data: nextData, timestamp: fallback.timestamp });
            setData(nextData);
            setError('');
            onData?.(normalizedTicker, nextData);
          } else {
            setError('Price unavailable');
          }
        }
      }
    };
    loadPrice();
    return () => {
      isActive = false;
    };
  }, [ticker, refreshToken, onData]);

  if (error) {
    return <p className="market-price market-price-error">{error}</p>;
  }

  if (!data) {
    return <p className="market-price">Loading price...</p>;
  }

  const change =
    typeof data.changePercent === 'number'
      ? `${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`
      : null;

  const updatedLabel = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : null;

  return (
    <div className={`market-price ${data.stale ? 'market-price-stale' : ''}`}>
      <div className="market-price-main">
        <span className="market-price-label">Price</span>
        <span className="market-price-value">
          {data.price.toFixed(2)} {data.currency ?? 'USD'}
        </span>
        {change && <span className="market-price-change">{change}</span>}
        {data.stale && <span className="market-price-note">Stale cache</span>}
      </div>
      {updatedLabel && (
        <div className="market-price-meta">
          <span>Updated {updatedLabel}</span>
          {data.cached && !data.stale && <span className="market-price-note">Cached</span>}
        </div>
      )}
    </div>
  );
}
