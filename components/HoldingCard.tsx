'use client';

import { useState } from 'react';

import FiftyTwoWeekRange from './FiftyTwoWeekRange';
import MarketPrice, { MarketData } from './MarketPrice';

type Holding = {
  id: string;
  ticker: string;
  label?: string;
  quantity?: number;
  purchasePrice?: number;
};

interface HoldingCardProps {
  holding: Holding;
  canEdit: boolean;
  quote?: MarketData;
  onQuoteUpdate?: (ticker: string, data: MarketData) => void;
  onRemove: (id: string) => Promise<void> | void;
  refreshToken?: number;
}

export default function HoldingCard({
  holding,
  canEdit,
  quote,
  onQuoteUpdate,
  onRemove,
  refreshToken,
}: HoldingCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRemove = async () => {
    try {
      setIsDeleting(true);
      await onRemove(holding.id);
    } catch (error) {
      console.error('Failed to remove holding', error);
      setIsDeleting(false);
    }
  };

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const currency = quote?.currency ?? 'USD';
  const price = quote?.price;
  const changePercent = quote?.changePercent;
  const quantity = holding.quantity;
  const purchasePrice = holding.purchasePrice;
  const totalValue =
    isFiniteNumber(price) && isFiniteNumber(quantity) ? price * quantity : null;
  const dailyChange =
    isFiniteNumber(price) && isFiniteNumber(quantity) && isFiniteNumber(changePercent)
      ? price * quantity * (changePercent / 100)
      : null;
  const costBasis =
    isFiniteNumber(purchasePrice) && isFiniteNumber(quantity) ? purchasePrice * quantity : null;
  const totalGain =
    isFiniteNumber(price) && isFiniteNumber(quantity) && isFiniteNumber(purchasePrice)
      ? (price - purchasePrice) * quantity
      : null;
  const totalGainPercent =
    isFiniteNumber(price) &&
    isFiniteNumber(purchasePrice) &&
    isFiniteNumber(quantity) &&
    purchasePrice !== 0
      ? ((price - purchasePrice) / purchasePrice) * 100
      : null;
  const formatCurrency = (value: number | null, withSign = false) => {
    if (value == null) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      signDisplay: withSign ? 'exceptZero' : 'auto',
    }).format(value);
  };
  const formatPercent = (value: number | null) => {
    if (value == null) return '--';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };
  const formatQuantity = (value: number | undefined) => {
    if (!isFiniteNumber(value)) return '--';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);
  };
  const changeClass =
    dailyChange != null
      ? dailyChange > 0
        ? 'stat-value-positive'
        : dailyChange < 0
          ? 'stat-value-negative'
          : ''
      : '';
  const gainClass =
    totalGain != null
      ? totalGain > 0
        ? 'stat-value-positive'
        : totalGain < 0
          ? 'stat-value-negative'
          : ''
      : '';

  const companyName = quote?.name;

  return (
    <article className="holding-card">
      <div className="holding-header">
        <div>
          <p className="holding-ticker">{holding.ticker}</p>
          <p className={`holding-label${companyName ? '' : ' holding-label-muted'}`}>
            {companyName || 'Loading...'}
          </p>
        </div>
        <div className="holding-actions">
          {canEdit && (
            <>
              {isConfirming ? (
                <>
                  <button
                    className="holding-remove"
                    onClick={() => void handleRemove()}
                    type="button"
                    disabled={isDeleting}
                    aria-label={`Confirm removal of ${holding.ticker}`}
                    style={{ borderColor: 'var(--accent-warm)', color: 'var(--accent-warm)' }}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    className="holding-edit-toggle"
                    onClick={() => setIsConfirming(false)}
                    type="button"
                    disabled={isDeleting}
                    aria-label="Cancel removal"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="holding-remove"
                  onClick={() => setIsConfirming(true)}
                  type="button"
                  disabled={isDeleting}
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <MarketPrice
        ticker={holding.ticker}
        refreshToken={refreshToken}
        onData={onQuoteUpdate}
      />
      <div className="holding-metrics">
        <div className="holding-metric">
          <p className="holding-metric-label">Current price</p>
          <p className="holding-metric-value">{formatCurrency(isFiniteNumber(price) ? price : null)}</p>
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Today&apos;s change</p>
          <p className={`holding-metric-value ${changeClass}`.trim()}>
            {formatCurrency(dailyChange, true)}
          </p>
          {isFiniteNumber(changePercent) && (
            <p className="holding-metric-sub">{formatPercent(changePercent)}</p>
          )}
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Purchase price</p>
          <p className="holding-metric-value">
            {formatCurrency(isFiniteNumber(purchasePrice) ? purchasePrice : null)}
          </p>
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Qty</p>
          <p className="holding-metric-value">{formatQuantity(quantity)}</p>
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Cost basis</p>
          <p className="holding-metric-value">{formatCurrency(costBasis)}</p>
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Total value</p>
          <p className="holding-metric-value">{formatCurrency(totalValue)}</p>
        </div>
        <div className="holding-metric">
          <p className="holding-metric-label">Total gain/loss</p>
          <p className={`holding-metric-value ${gainClass}`.trim()}>
            {formatCurrency(totalGain, true)}
          </p>
          {totalGainPercent != null && (
            <p className="holding-metric-sub">{formatPercent(totalGainPercent)}</p>
          )}
        </div>
      </div>
      <FiftyTwoWeekRange
        low={quote?.fiftyTwoWeekLow}
        high={quote?.fiftyTwoWeekHigh}
        current={quote?.price}
        currency={currency}
      />
    </article>
  );
}
