'use client';

import { useEffect, useState } from 'react';

import MarketPrice, { MarketData } from './MarketPrice';
import MarketSparkline from './MarketSparkline';

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
  onRemove: (id: string) => void;
  onUpdateHolding: (
    id: string,
    label: string,
    quantity: number | null,
    purchasePrice: number | null
  ) => Promise<void>;
}

export default function HoldingCard({
  holding,
  canEdit,
  quote,
  onQuoteUpdate,
  onRemove,
  onUpdateHolding,
}: HoldingCardProps) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(holding.label ?? '');
  const [draftQuantity, setDraftQuantity] = useState(
    holding.quantity != null ? String(holding.quantity) : ''
  );
  const [draftPurchasePrice, setDraftPurchasePrice] = useState(
    holding.purchasePrice != null ? String(holding.purchasePrice) : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDraftLabel(holding.label ?? '');
    setDraftQuantity(holding.quantity != null ? String(holding.quantity) : '');
    setDraftPurchasePrice(holding.purchasePrice != null ? String(holding.purchasePrice) : '');
  }, [holding.label, holding.quantity, holding.purchasePrice]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage('');
      const parseNumber = (
        value: string,
        fieldName: string
      ): { value: number | null; error?: string } => {
        const trimmed = value.trim();
        if (!trimmed) {
          return { value: null };
        }
        const numeric = Number.parseFloat(trimmed);
        if (!Number.isFinite(numeric) || numeric < 0) {
          return { value: null, error: `${fieldName} must be a non-negative number.` };
        }
        return { value: numeric };
      };
      const quantityResult = parseNumber(draftQuantity, 'Quantity');
      if (quantityResult.error) {
        setErrorMessage(quantityResult.error);
        return;
      }
      const purchaseResult = parseNumber(draftPurchasePrice, 'Purchase price');
      if (purchaseResult.error) {
        setErrorMessage(purchaseResult.error);
        return;
      }
      await onUpdateHolding(
        holding.id,
        draftLabel,
        quantityResult.value,
        purchaseResult.value
      );
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update holding details', error);
      setErrorMessage('Unable to update holding details.');
    } finally {
      setIsSaving(false);
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

  return (
    <article className="holding-card">
      <div className="holding-header">
        <div>
          <p className="holding-ticker">{holding.ticker}</p>
          {isEditing ? (
            <div className="holding-edit">
              <label>
                Label
                <input
                  type="text"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  placeholder="Optional label"
                  aria-label={`Edit label for ${holding.ticker}`}
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  value={draftQuantity}
                  onChange={(event) => setDraftQuantity(event.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </label>
              <label>
                Purchase price
                <input
                  type="number"
                  value={draftPurchasePrice}
                  onChange={(event) => setDraftPurchasePrice(event.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </label>
              {errorMessage && <p className="holding-edit-error">{errorMessage}</p>}
              <div className="holding-edit-actions">
                <button
                  className="holding-edit-save"
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="holding-edit-cancel"
                  type="button"
                  onClick={() => {
                    setDraftLabel(holding.label ?? '');
                    setDraftQuantity(holding.quantity != null ? String(holding.quantity) : '');
                    setDraftPurchasePrice(
                      holding.purchasePrice != null ? String(holding.purchasePrice) : ''
                    );
                    setErrorMessage('');
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`holding-label${holding.label ? '' : ' holding-label-muted'}`}>
              {holding.label || 'No label yet'}
            </p>
          )}
        </div>
        <div className="holding-actions">
          <button
            className="holding-refresh"
            onClick={() => setRefreshToken(prev => prev + 1)}
            type="button"
            title={`Refresh ${holding.ticker} market data`}
            aria-label={`Refresh ${holding.ticker} market data`}
            disabled={isSaving}
          >
            Refresh
          </button>
          {canEdit && (
            <>
              <button
                className="holding-edit-toggle"
                onClick={() => {
                  setDraftLabel(holding.label ?? '');
                  setDraftQuantity(holding.quantity != null ? String(holding.quantity) : '');
                  setDraftPurchasePrice(
                    holding.purchasePrice != null ? String(holding.purchasePrice) : ''
                  );
                  setErrorMessage('');
                  setIsEditing(prev => !prev);
                }}
                type="button"
                disabled={isSaving}
              >
                {isEditing ? 'Close' : 'Edit details'}
              </button>
              <button
                className="holding-remove"
                onClick={() => onRemove(holding.id)}
                type="button"
                disabled={isSaving}
              >
                Remove
              </button>
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
      <MarketSparkline ticker={holding.ticker} refreshToken={refreshToken} />
    </article>
  );
}
