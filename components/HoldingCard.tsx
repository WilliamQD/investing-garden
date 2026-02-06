'use client';

import { useState } from 'react';

import MarketPrice from './MarketPrice';
import MarketSparkline from './MarketSparkline';

type Holding = {
  id: string;
  ticker: string;
  label?: string;
};

interface HoldingCardProps {
  holding: Holding;
  canEdit: boolean;
  onRemove: (id: string) => void;
}

export default function HoldingCard({ holding, canEdit, onRemove }: HoldingCardProps) {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <article className="holding-card">
      <div className="holding-header">
        <div>
          <p className="holding-ticker">{holding.ticker}</p>
          {holding.label && <p className="holding-label">{holding.label}</p>}
        </div>
        <div className="holding-actions">
          <button
            className="holding-refresh"
            onClick={() => setRefreshToken(prev => prev + 1)}
            type="button"
            title={`Refresh ${holding.ticker} market data`}
            aria-label={`Refresh ${holding.ticker} market data`}
          >
            Refresh
          </button>
          {canEdit && (
            <button className="holding-remove" onClick={() => onRemove(holding.id)} type="button">
              Remove
            </button>
          )}
        </div>
      </div>
      <MarketPrice ticker={holding.ticker} refreshToken={refreshToken} />
      <MarketSparkline ticker={holding.ticker} refreshToken={refreshToken} />
    </article>
  );
}
