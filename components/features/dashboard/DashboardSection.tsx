'use client';

import { useCallback, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';
import { ApiError } from '@/lib/data/client';
import {
  updateSettings,
  useHoldings,
  useSiteSettings,
  useTrades,
} from '@/lib/data/dashboard';
import BackupRestore from '@/components/BackupRestore';
import HoldingsSection from '@/components/features/holdings/HoldingsSection';
import TradeHistory from '@/components/TradeHistory';

export default function DashboardSection() {
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    headline: '',
    summary: '',
    focusAreas: [] as string[],
    cashBalance: 0,
    cashLabel: 'SPAXX',
  }));
  const [focusAreasRaw, setFocusAreasRaw] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const { canWrite } = useAdmin();
  const {
    settings,
    mutate: mutateSettings,
  } = useSiteSettings();
  const {
    holdings,
    errorMessage: holdingsError,
    mutate: mutateHoldings,
  } = useHoldings();
  const {
    trades,
    errorMessage: tradesError,
    mutate: mutateTrades,
  } = useTrades();

  const openSettings = () => {
    setSettingsDraft({ ...settings, cashBalance: settings.cashBalance ?? 0, cashLabel: settings.cashLabel ?? 'SPAXX' });
    setFocusAreasRaw(settings.focusAreas.join(', '));
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!canWrite) {
        setStatusMessage('Sign in as admin to update overview settings.');
        return;
      }
      const finalDraft = {
        ...settingsDraft,
        focusAreas: focusAreasRaw.split(',').map(area => area.trim()).filter(Boolean),
      };
      const updated = await updateSettings(finalDraft);
      mutateSettings(updated, { revalidate: false });
      setSettingsDraft(prev => ({ ...prev, ...updated }));
      setSettingsOpen(false);
      setStatusMessage('');
    } catch (error) {
      console.error('Error updating settings:', error);
      setStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to update overview right now.'
      );
    }
  };

  const handlePortfolioValueChange = useCallback((value: number | null) => {
    setPortfolioValue(value);
  }, []);

  const cashBalance = settings.cashBalance ?? 0;
  const totalPortfolioValue = portfolioValue != null
    ? portfolioValue + cashBalance
    : cashBalance > 0 ? cashBalance : null;

  const realizedGainLoss = trades
    .filter(t => t.action === 'sell' && t.gainLoss != null)
    .reduce((sum, t) => sum + (t.gainLoss ?? 0), 0);

  return (
    <>
      <section className="hero">
        <div className="hero-left">
          <p className="eyebrow">Portfolio workspace</p>
          <h1>{settings.headline}</h1>
          <p className="hero-text">{settings.summary}</p>
          {settings.focusAreas.length > 0 && (
            <div className="hero-tags">
              {settings.focusAreas.map(area => (
                <span className="tag" key={area}>{area}</span>
              ))}
            </div>
          )}
          {canWrite && (
            <button className="chip-button" onClick={openSettings} type="button">
              Edit overview
            </button>
          )}
        </div>
        <div className="hero-right">
          <div className="stat-card">
            <div className="stat-label">Portfolio value</div>
            <div className="stat-value">
              {totalPortfolioValue != null
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalPortfolioValue)
                : 'Awaiting data'}
            </div>
            <div className="stat-sub">
              {portfolioValue != null && cashBalance > 0
                ? `Stocks + ${settings.cashLabel ?? 'Cash'}`
                : portfolioValue != null
                  ? 'Stocks only'
                  : 'Live from market data'}
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-card small">
              <div className="stat-label">Holdings tracked</div>
              <div className="stat-value">{holdings.length}</div>
              <div className="stat-sub">Symbols in view</div>
            </div>
            <div className="stat-card small">
              <div className="stat-label">Realized P&amp;L</div>
              <div className={`stat-value ${realizedGainLoss > 0 ? 'stat-value-positive' : realizedGainLoss < 0 ? 'stat-value-negative' : ''}`}>
                {trades.some(t => t.action === 'sell')
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' }).format(realizedGainLoss)
                  : '--'}
              </div>
              <div className="stat-sub">{trades.length} trade{trades.length !== 1 ? 's' : ''} logged</div>
            </div>
          </div>
          <p className="hero-disclaimer">
            This is a personal investing workspace. Nothing here is financial advice.
          </p>
        </div>
      </section>

      {(holdingsError || tradesError) && (
        <div className="status-banner">
          <div>
            <p className="status-title">Data connection issues</p>
            <ul className="status-list">
              {holdingsError && <li>{holdingsError}</li>}
              {tradesError && <li>{tradesError}</li>}
            </ul>
          </div>
          <div className="status-actions">
            {holdingsError && (
              <button type="button" onClick={() => void mutateHoldings()}>
                Retry holdings
              </button>
            )}
            {tradesError && (
              <button type="button" onClick={() => void mutateTrades()}>
                Retry trades
              </button>
            )}
          </div>
        </div>
      )}

      {statusMessage && <p className="auth-message">{statusMessage}</p>}

      <HoldingsSection
        holdings={holdings}
        canWrite={canWrite}
        onStatusMessage={setStatusMessage}
        mutateHoldings={mutateHoldings}
        settings={settings}
        onPortfolioValueChange={handlePortfolioValueChange}
      />

      <TradeHistory
        trades={trades}
        holdings={holdings}
        canWrite={canWrite}
        mutateTrades={mutateTrades}
        mutateHoldings={mutateHoldings}
      />

      {canWrite && <BackupRestore />}

      {settingsOpen && (
        <div className="modal" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit overview</h3>
              <button className="modal-close" onClick={() => setSettingsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label htmlFor="overview-headline">Headline</label>
                <input
                  id="overview-headline"
                  type="text"
                  value={settingsDraft.headline}
                  onChange={(event) => setSettingsDraft(prev => ({ ...prev, headline: event.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-summary">Summary</label>
                <textarea
                  id="overview-summary"
                  rows={4}
                  value={settingsDraft.summary}
                  onChange={(event) => setSettingsDraft(prev => ({ ...prev, summary: event.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-focus">Focus areas (comma-separated)</label>
                <input
                  id="overview-focus"
                  type="text"
                  value={focusAreasRaw}
                  onChange={(event) => setFocusAreasRaw(event.target.value)}
                  placeholder="macro, semis, risk"
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-cash-label">Cash position label</label>
                <input
                  id="overview-cash-label"
                  type="text"
                  value={settingsDraft.cashLabel}
                  onChange={(event) => setSettingsDraft(prev => ({ ...prev, cashLabel: event.target.value }))}
                  placeholder="SPAXX"
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-cash-balance">Cash balance ($)</label>
                <input
                  id="overview-cash-balance"
                  type="number"
                  value={settingsDraft.cashBalance}
                  onChange={(event) => setSettingsDraft(prev => ({ ...prev, cashBalance: Number(event.target.value) || 0 }))}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
