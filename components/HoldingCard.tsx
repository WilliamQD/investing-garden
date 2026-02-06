'use client';

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
  return (
    <article className="holding-card">
      <div className="holding-header">
        <div>
          <p className="holding-ticker">{holding.ticker}</p>
          {holding.label && <p className="holding-label">{holding.label}</p>}
        </div>
        {canEdit && (
          <button className="holding-remove" onClick={() => onRemove(holding.id)} type="button">
            Remove
          </button>
        )}
      </div>
      <MarketPrice ticker={holding.ticker} />
      <MarketSparkline ticker={holding.ticker} />
    </article>
  );
}
