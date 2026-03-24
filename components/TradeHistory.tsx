'use client';

import { useMemo, useState } from 'react';
import type { KeyedMutator } from 'swr';

import { ApiError } from '@/lib/data/client';
import {
  Holding,
  PortfolioTrade,
  addTrade,
  removeTrade,
  updateTrade,
} from '@/lib/data/dashboard';

interface TradeHistoryProps {
  trades: PortfolioTrade[];
  holdings: Holding[];
  canWrite: boolean;
  mutateTrades: KeyedMutator<PortfolioTrade[]>;
  mutateHoldings: KeyedMutator<Holding[]>;
}

type EntryMode = 'existing' | 'manual';

export default function TradeHistory({
  trades,
  holdings,
  canWrite,
  mutateTrades,
  mutateHoldings,
}: TradeHistoryProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('existing');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [manualTicker, setManualTicker] = useState('');
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    quantity: string;
    price: string;
    tradeDate: string;
    gainLoss: string;
    notes: string;
  }>({ quantity: '', price: '', tradeDate: '', gainLoss: '', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const holdingsWithQty = useMemo(
    () => holdings.filter(h => h.quantity != null && h.quantity > 0),
    [holdings]
  );

  const selectedHolding = useMemo(
    () => (entryMode === 'existing' ? holdingsWithQty.find(h => h.ticker === selectedTicker) : null),
    [entryMode, selectedTicker, holdingsWithQty]
  );

  const effectiveTicker = entryMode === 'existing' ? selectedTicker : manualTicker.trim().toUpperCase();

  // For sells from existing holding, use the holding's avg cost
  const effectivePurchasePrice = useMemo(() => {
    if (action !== 'sell') return null;
    if (entryMode === 'existing' && selectedHolding?.purchasePrice != null) {
      return selectedHolding.purchasePrice;
    }
    const parsed = Number(purchasePrice);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }, [action, entryMode, selectedHolding, purchasePrice]);

  // Auto-calculate gain/loss for sell trades
  const computedGainLoss = useMemo(() => {
    if (action !== 'sell') return null;
    const qty = Number(quantity);
    const sellPrice = Number(price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(sellPrice) || effectivePurchasePrice == null) {
      return null;
    }
    return (sellPrice - effectivePurchasePrice) * qty;
  }, [action, quantity, price, effectivePurchasePrice]);

  const resetForm = () => {
    setEntryMode('existing');
    setSelectedTicker('');
    setManualTicker('');
    setAction('buy');
    setQuantity('');
    setPrice('');
    setPurchasePrice('');
    setTradeDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setStatusMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      setStatusMessage('Sign in as admin to add trades.');
      return;
    }
    if (!effectiveTicker) {
      setStatusMessage('Select or enter a symbol.');
      return;
    }
    const qtyNum = Number(quantity);
    const priceNum = Number(price);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setStatusMessage('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setStatusMessage('Price must be a non-negative number.');
      return;
    }
    try {
      setSubmitting(true);
      setStatusMessage('');
      const trade = await addTrade({
        ticker: effectiveTicker,
        action,
        quantity: qtyNum,
        price: priceNum,
        tradeDate,
        gainLoss: computedGainLoss,
        notes: notes.trim() || undefined,
      });
      mutateTrades(current => {
        const next = [trade, ...(current ?? [])];
        return next.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
      }, { revalidate: false });
      // Refresh holdings since the server recalculated them
      void mutateHoldings();
      resetForm();
      setFormOpen(false);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to add trade right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await removeTrade(id);
      mutateTrades(current => (current ?? []).filter(t => t.id !== id), { revalidate: false });
      // Refresh holdings since the server recalculated them
      void mutateHoldings();
      setConfirmingId(null);
    } catch (error) {
      console.error('Error deleting trade:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (trade: PortfolioTrade) => {
    setEditingId(trade.id);
    setEditDraft({
      quantity: String(trade.quantity),
      price: String(trade.price),
      tradeDate: trade.tradeDate,
      gainLoss: trade.gainLoss != null ? String(trade.gainLoss) : '',
      notes: trade.notes ?? '',
    });
    setConfirmingId(null);
  };

  const handleSaveEdit = async (trade: PortfolioTrade) => {
    const qtyNum = Number(editDraft.quantity);
    const priceNum = Number(editDraft.price);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setStatusMessage('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setStatusMessage('Price must be a non-negative number.');
      return;
    }
    try {
      setSavingEdit(true);
      setStatusMessage('');
      const glParsed = editDraft.gainLoss !== '' ? Number(editDraft.gainLoss) : null;
      const updated = await updateTrade(trade.id, {
        quantity: qtyNum,
        price: priceNum,
        tradeDate: editDraft.tradeDate,
        gainLoss: glParsed != null && Number.isFinite(glParsed) ? glParsed : null,
        notes: editDraft.notes.trim() || null,
      });
      mutateTrades(current => {
        const next = (current ?? []).map(t => t.id === trade.id ? updated : t);
        return next.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
      }, { revalidate: false });
      void mutateHoldings();
      setEditingId(null);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to update trade.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const formatCurrency = (value: number, withSign = false) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      signDisplay: withSign ? 'exceptZero' : 'auto',
    }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <section className="trade-history-section">
      <div className="trade-history-header">
        <div>
          <p className="eyebrow">Activity log</p>
          <h2>Trade history</h2>
          <p className="hero-text">
            Log trades to build and update your holdings automatically.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              resetForm();
              setFormOpen(prev => !prev);
            }}
          >
            {formOpen ? 'Cancel' : 'Log trade'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="trade-form" onSubmit={handleSubmit}>
          <div className="trade-mode-toggle">
            <button
              type="button"
              className={`trade-mode-btn ${entryMode === 'existing' ? 'active' : ''}`}
              onClick={() => setEntryMode('existing')}
            >
              From holdings
            </button>
            <button
              type="button"
              className={`trade-mode-btn ${entryMode === 'manual' ? 'active' : ''}`}
              onClick={() => setEntryMode('manual')}
            >
              New symbol
            </button>
          </div>

          <div className="trade-form-row">
            {entryMode === 'existing' ? (
              <label>
                Holding
                <select
                  value={selectedTicker}
                  onChange={e => setSelectedTicker(e.target.value)}
                  required
                >
                  <option value="">Select a holding...</option>
                  {holdingsWithQty.map(h => (
                    <option key={h.id} value={h.ticker}>
                      {h.ticker}{h.quantity != null ? ` (${h.quantity} shares)` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Symbol
                <input
                  type="text"
                  value={manualTicker}
                  onChange={e => setManualTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  required
                />
              </label>
            )}
            <label>
              Action
              <select value={action} onChange={e => setAction(e.target.value as 'buy' | 'sell')}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label>
              Qty
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                required
              />
            </label>
            <label>
              {action === 'sell' ? 'Sell price' : 'Buy price'}
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
            </label>
          </div>

          <div className="trade-form-row">
            <label>
              Date
              <input
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                required
              />
            </label>
            {action === 'sell' && entryMode === 'manual' && (
              <label>
                Purchase price
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  placeholder="Avg cost per share"
                  min="0"
                  step="0.01"
                />
              </label>
            )}
            {action === 'sell' && (
              <label>
                Gain/Loss
                <input
                  type="text"
                  value={computedGainLoss != null ? formatCurrency(computedGainLoss, true) : '--'}
                  readOnly
                  className="trade-readonly"
                />
              </label>
            )}
            <label>
              Notes
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional note"
              />
            </label>
          </div>

          {action === 'sell' && entryMode === 'existing' && selectedHolding?.purchasePrice != null && (
            <p className="trade-auto-hint">
              Avg cost: {formatCurrency(selectedHolding.purchasePrice)} per share (from holding)
            </p>
          )}

          <div className="trade-form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save trade'}
            </button>
          </div>
          {statusMessage && <p className="auth-message">{statusMessage}</p>}
        </form>
      )}

      {trades.length === 0 ? (
        <p className="empty-message">No trades recorded yet.</p>
      ) : (
        <div className="trade-table-wrapper">
          <table className="trade-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Action</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Gain/Loss</th>
                <th>Notes</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => {
                const glClass = trade.gainLoss != null
                  ? trade.gainLoss > 0
                    ? 'stat-value-positive'
                    : trade.gainLoss < 0
                      ? 'stat-value-negative'
                      : ''
                  : '';
                const isEditing = editingId === trade.id;
                return (
                  <tr key={trade.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="date"
                            className="trade-edit-input"
                            value={editDraft.tradeDate}
                            onChange={e => setEditDraft(d => ({ ...d, tradeDate: e.target.value }))}
                          />
                        </td>
                        <td className="trade-ticker">{trade.ticker}</td>
                        <td>
                          <span className={`trade-action trade-action-${trade.action}`}>
                            {trade.action.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="trade-edit-input"
                            value={editDraft.quantity}
                            onChange={e => setEditDraft(d => ({ ...d, quantity: e.target.value }))}
                            min="0"
                            step="1"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="trade-edit-input"
                            value={editDraft.price}
                            onChange={e => setEditDraft(d => ({ ...d, price: e.target.value }))}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="trade-edit-input"
                            value={editDraft.gainLoss}
                            onChange={e => setEditDraft(d => ({ ...d, gainLoss: e.target.value }))}
                            step="0.01"
                            placeholder="--"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="trade-edit-input"
                            value={editDraft.notes}
                            onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                            placeholder="Optional note"
                          />
                        </td>
                        <td>
                          <span className="trade-confirm-actions">
                            <button
                              type="button"
                              className="trade-delete-confirm"
                              onClick={() => void handleSaveEdit(trade)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? '...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="trade-delete-cancel"
                              onClick={() => { setEditingId(null); setStatusMessage(''); }}
                            >
                              Cancel
                            </button>
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{formatDate(trade.tradeDate)}</td>
                        <td className="trade-ticker">{trade.ticker}</td>
                        <td>
                          <span className={`trade-action trade-action-${trade.action}`}>
                            {trade.action.toUpperCase()}
                          </span>
                        </td>
                        <td>{trade.quantity}</td>
                        <td>{formatCurrency(trade.price)}</td>
                        <td className={glClass}>
                          {trade.gainLoss != null ? formatCurrency(trade.gainLoss, true) : '--'}
                        </td>
                        <td className="trade-notes">{trade.notes || '--'}</td>
                        {canWrite && (
                          <td>
                            {confirmingId === trade.id ? (
                              <span className="trade-confirm-actions">
                                <button
                                  type="button"
                                  className="trade-delete-confirm"
                                  onClick={() => void handleDelete(trade.id)}
                                  disabled={deletingId === trade.id}
                                >
                                  {deletingId === trade.id ? '...' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  className="trade-delete-cancel"
                                  onClick={() => setConfirmingId(null)}
                                  disabled={deletingId === trade.id}
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <span className="trade-row-actions">
                                <button
                                  type="button"
                                  className="trade-edit"
                                  onClick={() => startEditing(trade)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="trade-delete"
                                  onClick={() => setConfirmingId(trade.id)}
                                >
                                  Remove
                                </button>
                              </span>
                            )}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
