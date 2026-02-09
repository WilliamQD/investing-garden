'use client';

import { useEffect, useMemo, useState } from 'react';

interface MarketSparklineProps {
  ticker: string;
  refreshToken?: number;
}

type Candle = {
  datetime: string;
  close: string;
};

const DEFAULT_CACHE_TTL = 180_000;
const MIN_CACHE_TTL = 60_000;
const MAX_CACHE_TTL = 300_000;
const cacheEnvValue = Number(process.env.NEXT_PUBLIC_MARKET_CACHE_TTL_MS);
const CACHE_TTL = Number.isFinite(cacheEnvValue)
  ? Math.min(Math.max(cacheEnvValue, MIN_CACHE_TTL), MAX_CACHE_TTL)
  : DEFAULT_CACHE_TTL;
const historyCache = new Map<string, { data: Candle[]; timestamp: number }>();

export default function MarketSparkline({ ticker, refreshToken }: MarketSparklineProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const normalizedTicker = ticker.trim().toUpperCase();
    const cached = historyCache.get(normalizedTicker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setCandles(cached.data);
      setError('');
      if (!refreshToken) {
        return () => {
          isActive = false;
        };
      }
    }

    const loadHistory = async () => {
      try {
        const refreshQuery = refreshToken ? `&refresh=${refreshToken}` : '';
        const response = await fetch(
          `/api/market/history?ticker=${encodeURIComponent(normalizedTicker)}${refreshQuery}`,
          refreshToken ? { cache: 'no-store' } : undefined
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
  }, [ticker, refreshToken]);

  const sparkline = useMemo(() => {
    if (!candles.length) {
      return { points: '', min: null, max: null, start: null, end: null };
    }
    const values = candles.map(point => Number(point.close)).filter(value => Number.isFinite(value));
    if (values.length < 2) {
      return { points: '', min: null, max: null, start: null, end: null };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 40;
    const points = values
      .map((value, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
    return {
      points,
      min,
      max,
      start: values[0],
      end: values[values.length - 1],
    };
  }, [candles]);

  const formatCurrency = (value: number | null) => {
    if (value == null) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  };
  const deltaPercent =
    sparkline.start != null && sparkline.end != null && sparkline.start !== 0
      ? ((sparkline.end - sparkline.start) / sparkline.start) * 100
      : null;

  if (error) {
    return <p className="sparkline-message">{error}</p>;
  }

  if (!candles.length) {
    return <p className="sparkline-message">Loading trend...</p>;
  }

  return (
    <div className="sparkline">
      <div className="sparkline-meta">
        <span>30d range</span>
        <span>
          {formatCurrency(sparkline.min)} → {formatCurrency(sparkline.max)}
        </span>
        <span
          className={`sparkline-delta ${
            deltaPercent != null
              ? deltaPercent > 0
                ? 'sparkline-delta-positive'
                : deltaPercent < 0
                  ? 'sparkline-delta-negative'
                  : ''
              : ''
          }`.trim()}
        >
          {deltaPercent != null ? `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(2)}%` : '--'}
        </span>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline points={sparkline.points} fill="none" stroke="url(#sparkline-grad)" strokeWidth="1.6" />
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
