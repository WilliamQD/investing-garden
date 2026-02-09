'use client';

import { useEffect, useMemo, useState } from 'react';

import portfolioMetrics from '@/lib/portfolio-metrics';
import { useAdmin } from '@/lib/admin-client';
import { ApiError } from '@/lib/data/client';
import {
  addSnapshot,
  updateSettings,
  useHoldings,
  usePortfolioSnapshots,
  useSiteSettings,
  useSortedSnapshots,
} from '@/lib/data/dashboard';
import HoldingsSection from '@/components/features/holdings/HoldingsSection';

export default function DashboardSection() {
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newValue, setNewValue] = useState('');
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    headline: '',
    summary: '',
    focusAreas: [] as string[],
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const { canWrite } = useAdmin();
  const {
    settings,
    mutate: mutateSettings,
  } = useSiteSettings();
  const {
    snapshots,
    errorMessage: portfolioError,
    mutate: mutateSnapshots,
  } = usePortfolioSnapshots();
  const {
    holdings,
    errorMessage: holdingsError,
    mutate: mutateHoldings,
  } = useHoldings();

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!snapshots.length) return;
    setNewValue(String(snapshots[snapshots.length - 1].value));
  }, [snapshots]);

  const orderedPoints = useSortedSnapshots(snapshots);

  const graphPath = useMemo(() => {
    if (!orderedPoints.length) return '';
    const values = orderedPoints.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 60;
    return orderedPoints
      .map((point, idx) => {
        const x = (idx / Math.max(orderedPoints.length - 1, 1)) * width;
        const y = height - ((point.value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [orderedPoints]);

  const latestSnapshot = orderedPoints[orderedPoints.length - 1];
  const latestSnapshotValue = latestSnapshot?.value;
  const firstSnapshotValue = orderedPoints[0]?.value;
  const snapshotDelta =
    latestSnapshotValue != null && firstSnapshotValue != null
      ? latestSnapshotValue - firstSnapshotValue
      : null;
  const snapshotDeltaPercent =
    snapshotDelta != null && firstSnapshotValue != null && firstSnapshotValue !== 0
      ? (snapshotDelta / firstSnapshotValue) * 100
      : null;
  const getPositivePrefix = (value: number | null) => (value != null && value > 0 ? '+' : '');
  const performanceHighlights = useMemo(
    () => portfolioMetrics.getPerformanceHighlights(snapshots),
    [snapshots]
  );

  const formatShortDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatPeriodValue = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'exceptZero',
      maximumFractionDigits: 0,
    }).format(value);
  const DAILY_CADENCE_THRESHOLD = 1.5;
  const cadenceLabel =
    performanceHighlights.cadence.averageGapDays != null
      ? performanceHighlights.cadence.averageGapDays <= DAILY_CADENCE_THRESHOLD
        ? 'Daily'
        : `Every ${Math.round(performanceHighlights.cadence.averageGapDays)} days`
      : 'No cadence yet';
  const cadenceSub =
    performanceHighlights.cadence.lastSnapshotDate != null
      ? `Last snapshot ${formatShortDate(performanceHighlights.cadence.lastSnapshotDate)}${
        performanceHighlights.cadence.daysSinceLast != null
          ? performanceHighlights.cadence.daysSinceLast === 0
            ? ' · today'
            : ` · ${performanceHighlights.cadence.daysSinceLast}d ago`
          : ''
      }`
      : 'Add a snapshot to start tracking.';

  const openSettings = () => {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  };

  const handleAddSnapshot = async (event: React.FormEvent) => {
    event.preventDefault();
    const valueNum = Number(newValue);
    if (Number.isNaN(valueNum)) return;
    try {
      if (!canWrite) {
        setStatusMessage('Sign in as admin to save snapshots.');
        return;
      }
      const snapshot = await addSnapshot({ date: newDate, value: valueNum });
      mutateSnapshots(current => {
        const filtered = (current ?? []).filter(point => point.date !== snapshot.date);
        return [...filtered, snapshot].sort((a, b) => a.date.localeCompare(b.date));
      }, { revalidate: false });
      setStatusMessage('');
    } catch (error) {
      console.error('Error saving snapshot:', error);
      setStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to save snapshot right now.'
      );
    }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!canWrite) {
        setStatusMessage('Sign in as admin to update overview settings.');
        return;
      }
      const updated = await updateSettings(settingsDraft);
      mutateSettings(updated, { revalidate: false });
      setSettingsDraft(updated);
      setSettingsOpen(false);
      setStatusMessage('');
    } catch (error) {
      console.error('Error updating settings:', error);
      setStatusMessage(
        error instanceof ApiError ? error.message : 'Unable to update overview right now.'
      );
    }
  };

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
            <div className="stat-label">Latest snapshot</div>
            <div className="stat-value">
              {latestSnapshotValue != null ? `$${latestSnapshotValue.toLocaleString()}` : 'No data yet'}
            </div>
            <div className="stat-sub">
              {latestSnapshot
                ? `As of ${new Date(latestSnapshot.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`
                : 'Add a snapshot to start tracking.'}
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-card small">
              <div className="stat-label">Holdings tracked</div>
              <div className="stat-value">{holdings.length}</div>
              <div className="stat-sub">Symbols in view</div>
            </div>
            <div className="stat-card small">
              <div className="stat-label">Mode</div>
              <div className="stat-value">{canWrite ? 'Admin' : 'Visitor'}</div>
              <div className="stat-sub">Edits {canWrite ? 'enabled' : 'locked'}</div>
            </div>
          </div>
          <p className="hero-disclaimer">
            This is a personal investing workspace. Nothing here is financial advice.
          </p>
        </div>
      </section>

      {(portfolioError || holdingsError) && (
        <div className="status-banner">
          <div>
            <p className="status-title">Data connection issues</p>
            <ul className="status-list">
              {portfolioError && <li>{portfolioError}</li>}
              {holdingsError && <li>{holdingsError}</li>}
            </ul>
          </div>
          <div className="status-actions">
            {portfolioError && (
              <button type="button" onClick={() => void mutateSnapshots()}>
                Retry snapshots
              </button>
            )}
            {holdingsError && (
              <button type="button" onClick={() => void mutateHoldings()}>
                Retry holdings
              </button>
            )}
          </div>
        </div>
      )}

      <section className="portfolio-section">
        <div className="portfolio-header">
          <div>
            <p className="eyebrow">Account value</p>
            <h2>Portfolio trajectory</h2>
            <p className="hero-text">
              Daily snapshots are stored in Neon for long-term tracking. Days without
              entries stay flat to keep the story honest.
            </p>
          </div>
          {canWrite ? (
            <form className="portfolio-form" onSubmit={handleAddSnapshot}>
              <label>
                Date
                <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
              </label>
              <label>
                Value (USD)
                <input
                  type="number"
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  required
                  min="0"
                  step="1"
                />
              </label>
              <button type="submit" className="btn-primary">Save snapshot</button>
            </form>
          ) : (
            <p className="admin-hint">Enable admin mode to add snapshots.</p>
          )}
        </div>
        {statusMessage && <p className="auth-message">{statusMessage}</p>}
        <div className="portfolio-graph">
          {orderedPoints.length ? (
            <>
              <svg viewBox="0 0 100 60" preserveAspectRatio="none">
                <polyline points={graphPath} fill="none" stroke="url(#grad)" strokeWidth="1.2" />
                <defs>
                  <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="account-stats">
                <div>
                  <p className="stat-label">Latest</p>
                  <p className="stat-value">
                    {latestSnapshotValue != null ? `$${latestSnapshotValue.toLocaleString()}` : '--'}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Start</p>
                  <p className="stat-value">
                    {firstSnapshotValue != null ? `$${firstSnapshotValue.toLocaleString()}` : '--'}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Change</p>
                  <p className="stat-value">
                    {snapshotDelta != null
                      ? `${getPositivePrefix(snapshotDelta)}$${snapshotDelta.toLocaleString()}`
                      : '--'}
                  </p>
                  <p className="stat-sub">
                    {snapshotDeltaPercent != null
                      ? `${getPositivePrefix(snapshotDeltaPercent)}${snapshotDeltaPercent.toFixed(1)}% since start`
                      : 'Add snapshots to see change.'}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Snapshots</p>
                  <p className="stat-value">{snapshots.length}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="empty-message">Add your first snapshot to see the graph.</p>
          )}
          <div className="performance-grid">
            {performanceHighlights.periods.map(period => {
              const periodValue =
                period.deltaPercent != null
                  ? `${getPositivePrefix(period.deltaPercent)}${period.deltaPercent.toFixed(1)}%`
                  : '--';
              const periodClass =
                period.deltaPercent != null
                  ? period.deltaPercent > 0
                    ? 'stat-value-positive'
                    : period.deltaPercent < 0
                      ? 'stat-value-negative'
                      : ''
                  : '';
              const periodSub =
                period.delta != null && period.startDate
                  ? `${formatPeriodValue(period.delta)} since ${formatShortDate(period.startDate)}${
                    period.isPartial ? ' · partial' : ''
                  }`
                  : snapshots.length
                    ? 'Not enough history yet.'
                    : 'Add snapshots to see performance.';
              return (
                <div className="stat-card small" key={period.label}>
                  <div className="stat-label">{period.label} performance</div>
                  <div className={`stat-value ${periodClass}`.trim()}>{periodValue}</div>
                  <div className="stat-sub">{periodSub}</div>
                </div>
              );
            })}
            <div className="stat-card small">
              <div className="stat-label">Snapshot cadence</div>
              <div className="stat-value">{cadenceLabel}</div>
              <div className="stat-sub">{cadenceSub}</div>
            </div>
          </div>
        </div>
      </section>

      <HoldingsSection
        holdings={holdings}
        canWrite={canWrite}
        onStatusMessage={setStatusMessage}
        mutateHoldings={mutateHoldings}
      />

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
                  value={settingsDraft.focusAreas.join(', ')}
                  onChange={(event) =>
                    setSettingsDraft(prev => ({
                      ...prev,
                      focusAreas: event.target.value
                        .split(',')
                        .map(area => area.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="macro, semis, risk"
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
