'use client';

import { useMemo, useState } from 'react';
import type { KeyedMutator } from 'swr';

import HoldingCard from '@/components/HoldingCard';
import holdingsImport from '@/lib/holdings-import';
import {
  ApiError,
} from '@/lib/data/client';
import {
  Holding,
  addHolding,
  importHoldings,
  removeHolding,
  updateHoldingLabel,
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [holdingsQuery, setHoldingsQuery] = useState('');

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

  const handleAddHolding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTicker.trim()) return;
    try {
      if (!canWrite) {
        onStatusMessage('Sign in as admin to add holdings.');
        return;
      }
      const holding = await addHolding({
        ticker: newTicker.trim(),
        label: newLabel.trim() || undefined,
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

  const handleUpdateHoldingLabel = async (id: string, label: string) => {
    try {
      if (!canWrite) {
        onStatusMessage('Sign in as admin to update holding labels.');
        throw new Error('Unauthorized');
      }
      const updated = await updateHoldingLabel({ id, label });
      mutateHoldings(
        current => (current ?? []).map(item => (item.id === updated.id ? updated : item)),
        { revalidate: false }
      );
      onStatusMessage('');
    } catch (error) {
      console.error('Error updating holding label:', error);
      if (error instanceof ApiError) {
        onStatusMessage(error.message);
      } else {
        onStatusMessage('Unable to update holding label right now.');
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
            <button type="submit" className="btn-primary">Add holding</button>
          </form>
        ) : (
          <p className="admin-hint">Enable admin mode to add holdings.</p>
        )}
      </div>
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
                Holdings list (Ticker, Label)
                <textarea
                  value={bulkText}
                  onChange={(event) => {
                    setBulkText(event.target.value);
                    if (bulkStatus) setBulkStatus('');
                  }}
                  placeholder={`ticker,label\nAAPL, Core position\nMSFT\nNVDA, Momentum\n(limit ${holdingsImport.MAX_BULK_HOLDINGS})`}
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
              onRemove={handleRemoveHolding}
              onUpdateLabel={handleUpdateHoldingLabel}
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
