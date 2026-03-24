'use client';

import { useState } from 'react';
import type { KeyedMutator } from 'swr';

import { ApiError } from '@/lib/data/client';
import {
  PortfolioTrade,
  addTrade,
  removeTrade,
} from '@/lib/data/dashboard';

interface TradeHistoryProps {
  trades: PortfolioTrade[];
  canWrite: boolean;
  mutateTrades: KeyedMutator<PortfolioTrade[]>;
}

export default function TradeHistory({ trades, canWrite, mutateTrades }: TradeHistoryProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [action, setAction] = useState<'buy' | 'sell'>('sell');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gainLoss, setGainLoss] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setTicker('');
    setAction('sell');
    setQuantity('');
    setPrice('');
    setTradeDate(new Date().toISOString().slice(0, 10));
    setGainLoss('');
    setNotes('');
    setStatusMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      setStatusMessage('Sign in as admin to add trades.');
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
    const glRaw = gainLoss.trim();
    let glValue: number | null = null;
    if (glRaw) {
      const parsed = Number(glRaw);
      if (!Number.isFinite(parsed)) {
        setStatusMessage('Gain/loss must be a number.');
        return;
      }
      glValue = parsed;
    }
    try {
      setSubmitting(true);
      setStatusMessage('');
      const trade = await addTrade({
        ticker: ticker.trim(),
        action,
        quantity: qtyNum,
        price: priceNum,
        tradeDate,
        gainLoss: glValue,
        notes: notes.trim() || undefined,
      });
      mutateTrades(current => {
        const next = [trade, ...(current ?? [])];
        return next.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
      }, { revalidate: false });
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
      setConfirmingId(null);
    } catch (error) {
      console.error('Error deleting trade:', error);
    } finally {
      setDeletingId(null);
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
    });

  return (
    <section className="trade-history-section">
      <div className="trade-history-header">
        <div>
          <p className="eyebrow">Activity log</p>
          <h2>Trade history</h2>
          <p className="hero-text">
            Record completed trades to track your performance over time.
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
            {formOpen ? 'Cancel' : 'Add trade'}
          </button>
        )}
      </div>

      {formOpen && (
        <form className="trade-form" onSubmit={handleSubmit}>
          <div className="trade-form-row">
            <label>
              Symbol
              <input
                type="text"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="MU"
                required
              />
            </label>
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
              Price
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
            <label>
              Gain/Loss
              <input
                type="number"
                value={gainLoss}
                onChange={e => setGainLoss(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </label>
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
                return (
                  <tr key={trade.id}>
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
                          <button
                            type="button"
                            className="trade-delete"
                            onClick={() => setConfirmingId(trade.id)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
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
