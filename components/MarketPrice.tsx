'use client';

import { useEffect, useState } from 'react';

interface MarketPriceProps {
  ticker: string;
}

interface MarketData {
  price: number;
  currency?: string;
  changePercent?: number;
  updatedAt?: string;
  stale?: boolean;
}

const DEFAULT_CACHE_TTL = 180_000;
const MIN_CACHE_TTL = 60_000;
const MAX_CACHE_TTL = 300_000;
const cacheEnvValue = Number(process.env.NEXT_PUBLIC_MARKET_CACHE_TTL_MS);
const CACHE_TTL = Number.isFinite(cacheEnvValue)
  ? Math.min(Math.max(cacheEnvValue, MIN_CACHE_TTL), MAX_CACHE_TTL)
  : DEFAULT_CACHE_TTL;
const marketCache = new Map<string, { data: MarketData; timestamp: number }>();

export default function MarketPrice({ ticker }: MarketPriceProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const normalizedTicker = ticker.trim().toUpperCase();
    const cached = marketCache.get(normalizedTicker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data);
      setError('');
      return () => {
        isActive = false;
      };
    }
    const loadPrice = async () => {
      try {
        setError('');
        const response = await fetch(
          `/api/market?ticker=${encodeURIComponent(normalizedTicker)}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch market data');
        }
        const result = await response.json();
        if (isActive) {
          const nextData = {
            price: result.price,
            currency: result.currency,
            changePercent: result.changePercent,
            updatedAt: result.updatedAt,
            stale: result.stale,
          };
          marketCache.set(normalizedTicker, { data: nextData, timestamp: Date.now() });
          setData(nextData);
        }
      } catch (error) {
        console.error('Market price fetch failed', error);
        if (isActive) {
          setError('Price unavailable');
        }
      }
    };
    loadPrice();
    return () => {
      isActive = false;
    };
  }, [ticker]);

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

  return (
    <div className={`market-price ${data.stale ? 'market-price-stale' : ''}`}>
      <span className="market-price-label">Price</span>
      <span className="market-price-value">
        {data.price.toFixed(2)} {data.currency ?? 'USD'}
      </span>
      {change && <span className="market-price-change">{change}</span>}
      {data.stale && <span className="market-price-note">Stale</span>}
    </div>
  );
}
