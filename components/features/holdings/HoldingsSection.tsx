'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyedMutator } from 'swr';

import HoldingCard from '@/components/HoldingCard';
import type { MarketData } from '@/components/MarketPrice';
import holdingsImport from '@/lib/holdings-import';
import {
  ApiError,
} from '@/lib/data/client';
import {
  Holding,
  addHolding,
  importHoldings,
  removeHolding,
  updateHolding,
} from '@/lib/data/dashboard';

type HoldingsSectionProps = {
  holdings: Holding[];
  canWrite: boolean;
  onStatusMessage: (message: string) => void;
  mutateHoldings: KeyedMutator<Holding[]>;
};

export default function HoldingsSection({
  holdings,
  canWrite,
  onStatusMessage,
  mutateHoldings,
}: HoldingsSectionProps) {
  const [newTicker, setNewTicker] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [holdingsQuery, setHoldingsQuery] = useState('');
  const [quotes, setQuotes] = useState<Record<string, MarketData>>({});
  const bulkPlaceholder = `ticker,label,quantity,purchasePrice\nAAPL, Core position,10,150\nMSFT,,5,250\nNVDA, Momentum,12,430\n(limit ${holdingsImport.MAX_BULK_HOLDINGS})`;

  const bulkPreview = useMemo(() => holdingsImport.parseHoldingsCsv(bulkText), [bulkText]);
  const filteredHoldings = useMemo(() => {
    if (!holdingsQuery.trim()) return holdings;
    const query = holdingsQuery.trim().toLowerCase();
    return holdings.filter(
      holding =>
        holding.ticker.toLowerCase().includes(query) ||
        holding.label?.toLowerCase().includes(query)
    );
  }, [holdings, holdingsQuery]);
  const handleQuoteUpdate = useCallback((ticker: string, data: MarketData) => {
    setQuotes(prev => ({ ...prev, [ticker]: data }));
  }, []);
  useEffect(() => {
    setQuotes(prev => {
      const next = { ...prev };
      const tickers = new Set(holdings.map(holding => holding.ticker));
      Object.keys(next).forEach(key => {
        if (!tickers.has(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [holdings]);
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const holdingsSummary = useMemo(() => {
    let totalValue = 0;
    let totalChange = 0;
    let totalCost = 0;
    let totalGain = 0;
    let valueCount = 0;
    let gainCount = 0;
    holdings.forEach(holding => {
      const quote = quotes[holding.ticker];
      if (!quote || !isFiniteNumber(quote.price)) return;
      if (isFiniteNumber(holding.quantity)) {
        valueCount += 1;
        const positionValue = quote.price * holding.quantity;
        totalValue += positionValue;
        if (isFiniteNumber(quote.changePercent)) {
          totalChange += positionValue * (quote.changePercent / 100);
        }
        if (isFiniteNumber(holding.purchasePrice)) {
          gainCount += 1;
          totalCost += holding.purchasePrice * holding.quantity;
          totalGain += (quote.price - holding.purchasePrice) * holding.quantity;
        }
      }
    });
    const totalChangePercent =
      valueCount && totalValue !== 0 ? (totalChange / totalValue) * 100 : null;
    const totalGainPercent =
      gainCount && totalCost !== 0 ? (totalGain / totalCost) * 100 : null;
    return {
      totalValue,
      totalChange,
      totalChangePercent,
      totalGain,
      totalGainPercent,
      valueCount,
      gainCount,
    };
  }, [holdings, quotes]);
  const formatCurrency = (value: number | null, withSign = false) => {
    if (value == null) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      signDisplay: withSign ? 'exceptZero' : 'auto',
    }).format(value);
  };
  const formatPercent = (value: number | null) => {
    if (value == null) return '--';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  const handleAddHolding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTicker.trim()) return;
    try {
      if (!canWrite) {
        onStatusMessage('Sign in as admin to add holdings.');
        return;
      }
      const quantityValue = newQuantity.trim();
      let quantity: number | null = null;
      if (quantityValue) {
        const parsed = Number(quantityValue);
        if (Number.isNaN(parsed) || parsed < 0) {
          onStatusMessage('Quantity must be a non-negative number.');
          return;
        }
        quantity = parsed;
      }
      const purchaseValue = newPurchasePrice.trim();
      let purchasePrice: number | null = null;
      if (purchaseValue) {
        const parsed = Number(purchaseValue);
        if (Number.isNaN(parsed) || parsed < 0) {
          onStatusMessage('Purchase price must be a non-negative number.');
          return;
        }
        purchasePrice = parsed;
      }
      const holding = await addHolding({
        ticker: newTicker.trim(),
        label: newLabel.trim() || undefined,
        quantity,
        purchasePrice,
      });
      mutateHoldings(current => {
        const existing = current ?? [];
        if (existing.find(item => item.id === holding.id)) {
          return existing;
        }
        return [holding, ...existing];
      }, { revalidate: false });
      setNewTicker('');
      setNewLabel('');
      setNewQuantity('');
      setNewPurchasePrice('');
      onStatusMessage('');
    } catch (error) {
      console.error('Error adding holding:', error);
      onStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to add holding right now.'
      );
    }
  };

  const handleBulkImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      setBulkStatus('Sign in as admin to import holdings.');
      return;
    }
    if (bulkPreview.errors.length) {
      setBulkStatus('Resolve the import issues before submitting.');
      return;
    }
    if (!bulkPreview.holdings.length) {
      setBulkStatus('Add at least one holding to import.');
      return;
    }
    try {
      setBulkSubmitting(true);
      setBulkStatus('');
      const result = await importHoldings({ holdings: bulkPreview.holdings });
      const imported = Array.isArray(result.holdings) ? result.holdings : [];
      mutateHoldings(current => {
        const next = [...(current ?? [])];
        imported.forEach(holding => {
          const index = next.findIndex(item => item.id === holding.id);
          if (index >= 0) {
            next[index] = holding;
          } else {
            next.unshift(holding);
          }
        });
        return next;
      }, { revalidate: false });
      const skipped = Number(result.skipped) || 0;
      setBulkStatus(
        `Imported ${imported.length} holding${imported.length === 1 ? '' : 's'}${
          skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''
        }.`
      );
      setBulkText('');
      setBulkOpen(false);
    } catch (error) {
      console.error('Error importing holdings:', error);
      setBulkStatus(
        error instanceof ApiError ? error.message : 'Unable to import holdings right now.'
      );
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleRemoveHolding = async (id: string) => {
    try {
      if (!canWrite) {
        onStatusMessage('Sign in as admin to remove holdings.');
        return;
      }
      await removeHolding(id);
      mutateHoldings(current => (current ?? []).filter(item => item.id !== id), {
        revalidate: false,
      });
      onStatusMessage('');
    } catch (error) {
      console.error('Error removing holding:', error);
      onStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to remove holding right now.'
      );
    }
  };

  const handleUpdateHolding = async (
    id: string,
    label: string,
    quantity: number | null,
    purchasePrice: number | null
  ) => {
    try {
      if (!canWrite) {
        onStatusMessage('Sign in as admin to update holding details.');
        throw new Error('Unauthorized');
      }
      const updated = await updateHolding({ id, label, quantity, purchasePrice });
      mutateHoldings(
        current => (current ?? []).map(item => (item.id === updated.id ? updated : item)),
        { revalidate: false }
      );
      onStatusMessage('');
    } catch (error) {
      console.error('Error updating holding details:', error);
      if (error instanceof ApiError) {
        onStatusMessage(error.message);
      } else {
        onStatusMessage('Unable to update holding details right now.');
      }
      throw error;
    }
  };

  return (
    <section className="holdings-section">
      <div className="holdings-header">
        <div>
          <p className="eyebrow">Market view</p>
          <h2>Tracked holdings</h2>
          <p className="hero-text">
            Add symbols you care about to monitor live prices and recent trends.
          </p>
        </div>
        {canWrite ? (
          <form className="holdings-form" onSubmit={handleAddHolding}>
            <label>
              Symbol
              <input
                type="text"
                value={newTicker}
                onChange={(event) => setNewTicker(event.target.value.toUpperCase())}
                placeholder="AAPL"
                required
              />
            </label>
            <label>
              Label (optional)
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Core position"
              />
            </label>
            <label>
              Qty
              <input
                type="number"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                placeholder="0"
                min="0"
                step="1"
              />
            </label>
            <label>
              Purchase price
              <input
                type="number"
                value={newPurchasePrice}
                onChange={(event) => setNewPurchasePrice(event.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </label>
            <button type="submit" className="btn-primary">Add holding</button>
          </form>
        ) : (
          <p className="admin-hint">Enable admin mode to add holdings.</p>
        )}
      </div>
      {holdings.length > 0 && (
        <div className="holdings-summary">
          <div className="stat-card small">
            <div className="stat-label">Total value</div>
            <div className="stat-value">
              {holdingsSummary.valueCount ? formatCurrency(holdingsSummary.totalValue) : '--'}
            </div>
            <div className="stat-sub">
              {holdingsSummary.valueCount
                ? `${holdingsSummary.valueCount} position${holdingsSummary.valueCount === 1 ? '' : 's'} with qty`
                : 'Add quantities to see totals.'}
            </div>
          </div>
          <div className="stat-card small">
            <div className="stat-label">Today&apos;s change</div>
            <div
              className={`stat-value ${
                holdingsSummary.totalChange > 0
                  ? 'stat-value-positive'
                  : holdingsSummary.totalChange < 0
                    ? 'stat-value-negative'
                    : ''
              }`.trim()}
            >
              {holdingsSummary.valueCount
                ? formatCurrency(holdingsSummary.totalChange, true)
                : '--'}
            </div>
            <div className="stat-sub">
              {holdingsSummary.valueCount && holdingsSummary.totalChangePercent != null
                ? `${formatPercent(holdingsSummary.totalChangePercent)} today`
                : 'Awaiting live pricing.'}
            </div>
          </div>
          <div className="stat-card small">
            <div className="stat-label">Total gain/loss</div>
            <div
              className={`stat-value ${
                holdingsSummary.totalGain > 0
                  ? 'stat-value-positive'
                  : holdingsSummary.totalGain < 0
                    ? 'stat-value-negative'
                    : ''
              }`.trim()}
            >
              {holdingsSummary.gainCount
                ? formatCurrency(holdingsSummary.totalGain, true)
                : '--'}
            </div>
            <div className="stat-sub">
              {holdingsSummary.gainCount && holdingsSummary.totalGainPercent != null
                ? `${formatPercent(holdingsSummary.totalGainPercent)} overall`
                : 'Add purchase prices to track gains.'}
            </div>
          </div>
        </div>
      )}
      {canWrite && (
        <div className="holdings-import">
          <div className="holdings-import-header">
            <div>
              <p className="eyebrow-alt">Bulk import</p>
              <p className="panel-sub">Paste a CSV to add multiple tickers at once.</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setBulkOpen(prev => !prev)}
            >
              {bulkOpen ? 'Close importer' : 'Open importer'}
            </button>
          </div>
          {bulkOpen && (
            <form className="holdings-import-form" onSubmit={handleBulkImport}>
              <label>
                Holdings list (Ticker, Label, Qty, Purchase Price)
                <textarea
                  value={bulkText}
                  onChange={(event) => {
                    setBulkText(event.target.value);
                    if (bulkStatus) setBulkStatus('');
                  }}
                  placeholder={bulkPlaceholder}
                  rows={5}
                />
              </label>
              <div className="holdings-import-meta">
                <span>{bulkPreview.holdings.length} ready</span>
                {bulkPreview.skipped > 0 && (
                  <span>
                    {bulkPreview.skipped} duplicate{bulkPreview.skipped === 1 ? '' : 's'} skipped
                  </span>
                )}
                {bulkPreview.errors.length > 0 && (
                  <span>
                    {bulkPreview.errors.length} issue{bulkPreview.errors.length === 1 ? '' : 's'} to fix
                  </span>
                )}
              </div>
              {bulkPreview.errors.length > 0 && (
                <ul className="holdings-import-errors">
                  {bulkPreview.errors.map((error: { line?: number; message: string }, index: number) => (
                    <li key={`${error.line ?? 'general'}-${index}`}>
                      {error.line ? `Line ${error.line}: ` : ''}
                      {error.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="holdings-import-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={bulkSubmitting || !bulkPreview.holdings.length || bulkPreview.errors.length > 0}
                >
                  {bulkSubmitting ? 'Importing...' : 'Import holdings'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setBulkText('');
                    setBulkStatus('');
                  }}
                  disabled={bulkSubmitting}
                >
                  Clear
                </button>
              </div>
            </form>
          )}
          {bulkStatus && <p className="auth-message">{bulkStatus}</p>}
        </div>
      )}
      {holdings.length > 0 && (
        <div className="holdings-controls">
          <label>
            Search holdings
            <input
              type="text"
              value={holdingsQuery}
              onChange={(event) => setHoldingsQuery(event.target.value)}
              placeholder="Filter by ticker or label"
            />
          </label>
          <p className="holdings-count">
            {filteredHoldings.length} of {holdings.length} holdings
          </p>
        </div>
      )}
      <div className="holdings-grid">
        {filteredHoldings.length ? (
          filteredHoldings.map(holding => (
            <HoldingCard
              key={holding.id}
              holding={holding}
              canEdit={canWrite}
              quote={quotes[holding.ticker]}
              onQuoteUpdate={handleQuoteUpdate}
              onRemove={handleRemoveHolding}
              onUpdateHolding={handleUpdateHolding}
            />
          ))
        ) : (
          <p className="empty-message">
            {holdings.length
              ? 'No holdings match your search.'
              : 'No holdings yet. Add a symbol to start tracking.'}
          </p>
        )}
      </div>
    </section>
  );
}
