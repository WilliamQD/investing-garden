'use client';

import { useEffect, useMemo, useState } from 'react';

interface MarketSparklineProps {
  ticker: string;
}

type Candle = {
  datetime: string;
  close: string;
};

const DEFAULT_CACHE_TTL = 180_000;
const cacheEnvValue = Number(process.env.NEXT_PUBLIC_MARKET_CACHE_TTL_MS);
const CACHE_TTL = Number.isFinite(cacheEnvValue) ? cacheEnvValue : DEFAULT_CACHE_TTL;
const historyCache = new Map<string, { data: Candle[]; timestamp: number }>();

export default function MarketSparkline({ ticker }: MarketSparklineProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const normalizedTicker = ticker.trim().toUpperCase();
    const cached = historyCache.get(normalizedTicker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setCandles(cached.data);
      setError('');
      return () => {
        isActive = false;
      };
    }

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `/api/market/history?ticker=${encodeURIComponent(normalizedTicker)}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }
        const result = await response.json();
        if (isActive) {
          const values = Array.isArray(result.candles) ? result.candles : [];
          historyCache.set(normalizedTicker, { data: values, timestamp: Date.now() });
          setCandles(values);
          setError('');
        }
      } catch (err) {
        console.error('Market history fetch failed', err);
        if (isActive) {
          setError('History unavailable');
        }
      }
    };
    loadHistory();
    return () => {
      isActive = false;
    };
  }, [ticker]);

  const sparkline = useMemo(() => {
    if (!candles.length) return '';
    const values = candles.map(point => Number(point.close)).filter(value => Number.isFinite(value));
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 40;
    return values
      .map((value, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [candles]);

  if (error) {
    return <p className="sparkline-message">{error}</p>;
  }

  if (!candles.length) {
    return <p className="sparkline-message">Loading trend...</p>;
  }

  return (
    <div className="sparkline">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline points={sparkline} fill="none" stroke="url(#sparkline-grad)" strokeWidth="1.6" />
        <defs>
          <linearGradient id="sparkline-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
