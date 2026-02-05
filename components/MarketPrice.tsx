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
}

export default function MarketPrice({ ticker }: MarketPriceProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const loadPrice = async () => {
      try {
        setError('');
        const response = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch market data');
        }
        const result = await response.json();
        if (isActive) {
          setData({
            price: result.price,
            currency: result.currency,
            changePercent: result.changePercent,
            updatedAt: result.updatedAt,
          });
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
    <div className="market-price">
      <span className="market-price-label">Price</span>
      <span className="market-price-value">
        {data.price.toFixed(2)} {data.currency ?? 'USD'}
      </span>
      {change && <span className="market-price-change">{change}</span>}
    </div>
  );
}
