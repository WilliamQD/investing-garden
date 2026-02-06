'use client';

import { useEffect, useMemo, useState } from 'react';

import AuthControls from '@/components/AuthControls';
import HoldingCard from '@/components/HoldingCard';
import KnowledgeSection from '@/components/KnowledgeSection';
import Section from '@/components/Section';
import StatsPanel from '@/components/StatsPanel';
import { useAdmin } from '@/lib/admin-client';
import holdingsImport from '@/lib/holdings-import';
import portfolioMetrics from '@/lib/portfolio-metrics';

type SectionKey = 'dashboard' | 'journal' | 'knowledge' | 'stats';

type PortfolioSnapshot = { date: string; value: number };

type Holding = { id: string; ticker: string; label?: string };

type SiteSettings = {
  headline: string;
  summary: string;
  focusAreas: string[];
};

const DEFAULT_SETTINGS: SiteSettings = {
  headline: 'Investing Garden',
  summary:
    'A clean, industrial workspace for tracking portfolio moves, market context, and research notes in one place.',
  focusAreas: [],
};

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newValue, setNewValue] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [holdingsQuery, setHoldingsQuery] = useState('');
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const [holdingsError, setHoldingsError] = useState('');
  const currentYear = new Date().getFullYear();
  const { authHeaders, hasAdminToken } = useAdmin();

  useEffect(() => {
    void loadSettings();
    void loadSnapshots();
    void loadHoldings();
  }, []);

  useEffect(() => {
    if (!snapshots.length) return;
    setNewValue(String(snapshots[snapshots.length - 1].value));
  }, [snapshots]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
      setSettingsDraft(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const loadSnapshots = async () => {
    try {
      setPortfolioError('');
      const response = await fetch('/api/portfolio/snapshots');
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setSnapshots(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('accountSnapshots', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      setPortfolioError('Snapshot history unavailable.');
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('accountSnapshots');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setSnapshots(parsed);
            }
          } catch (err) {
            console.error('Failed to parse cached snapshots', err);
          }
        }
      }
    }
  };

  const loadHoldings = async () => {
    try {
      setHoldingsError('');
      const response = await fetch('/api/portfolio/holdings');
      if (!response.ok) {
        throw new Error('Failed to fetch holdings');
      }
      const data = await response.json();
      setHoldings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      setHoldingsError('Holdings list unavailable.');
    }
  };

  const handleAddSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    const valueNum = Number(newValue);
    if (Number.isNaN(valueNum)) return;
    try {
      if (!hasAdminToken) {
        setStatusMessage('Enter the admin token to save snapshots.');
        return;
      }
      const response = await fetch('/api/portfolio/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ date: newDate, value: valueNum }),
        credentials: 'include',
      });
      if (response.status === 401) {
        setStatusMessage('Enter the admin token to save snapshots.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to save snapshot');
      }
      const snapshot = await response.json();
      setSnapshots(prev => {
        const filtered = prev.filter(point => point.date !== snapshot.date);
        return [...filtered, snapshot].sort((a, b) => a.date.localeCompare(b.date));
      });
      setStatusMessage('');
    } catch (error) {
      console.error('Error saving snapshot:', error);
      setStatusMessage('Unable to save snapshot right now.');
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;
    try {
      if (!hasAdminToken) {
        setStatusMessage('Enter the admin token to add holdings.');
        return;
      }
      const response = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ticker: newTicker.trim(), label: newLabel.trim() || undefined }),
        credentials: 'include',
      });
      if (response.status === 401) {
        setStatusMessage('Enter the admin token to add holdings.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to add holding');
      }
      const holding = await response.json();
      setHoldings(prev => {
        if (prev.find(item => item.id === holding.id)) {
          return prev;
        }
        return [holding, ...prev];
      });
      setNewTicker('');
      setNewLabel('');
      setStatusMessage('');
    } catch (error) {
      console.error('Error adding holding:', error);
      setStatusMessage('Unable to add holding right now.');
    }
  };

  const handleBulkImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasAdminToken) {
      setBulkStatus('Enter the admin token to import holdings.');
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
      const response = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ holdings: bulkPreview.holdings }),
        credentials: 'include',
      });
      if (response.status === 401) {
        setBulkStatus('Enter the admin token to import holdings.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to import holdings');
      }
      const result = await response.json();
      const imported = Array.isArray(result.holdings) ? result.holdings : [];
      setHoldings(prev => {
        const next = [...prev];
        imported.forEach((holding: Holding) => {
          const index = next.findIndex(item => item.id === holding.id);
          if (index >= 0) {
            next[index] = holding;
          } else {
            next.unshift(holding);
          }
        });
        return next;
      });
      const skipped = Number(result.skipped) || 0;
      setBulkStatus(
        `Imported ${imported.length} holding${imported.length === 1 ? '' : 's'}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`
      );
      setBulkText('');
      setBulkOpen(false);
    } catch (error) {
      console.error('Error importing holdings:', error);
      setBulkStatus('Unable to import holdings right now.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleRemoveHolding = async (id: string) => {
    try {
      if (!hasAdminToken) {
        setStatusMessage('Enter the admin token to remove holdings.');
        return;
      }
      const response = await fetch(`/api/portfolio/holdings/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.status === 401) {
        setStatusMessage('Enter the admin token to remove holdings.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to delete holding');
      }
      setHoldings(prev => prev.filter(item => item.id !== id));
      setStatusMessage('');
    } catch (error) {
      console.error('Error removing holding:', error);
      setStatusMessage('Unable to remove holding right now.');
    }
  };

  const handleUpdateHoldingLabel = async (id: string, label: string) => {
    try {
      const response = await fetch(`/api/portfolio/holdings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ label }),
        credentials: 'include',
      });
      if (response.status === 401) {
        setStatusMessage('Enter the admin token to update holding labels.');
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        throw new Error('Failed to update holding');
      }
      const updated = await response.json();
      setHoldings(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setStatusMessage('');
    } catch (error) {
      console.error('Error updating holding label:', error);
      setStatusMessage('Unable to update holding label right now.');
      throw error;
    }
  };

  const openSettings = () => {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!hasAdminToken) {
        setStatusMessage('Enter the admin token to update overview settings.');
        return;
      }
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(settingsDraft),
        credentials: 'include',
      });
      if (response.status === 401) {
        setStatusMessage('Enter the admin token to update overview settings.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      const updated = await response.json();
      setSettings(updated);
      setSettingsDraft(updated);
      setSettingsOpen(false);
      setStatusMessage('');
    } catch (error) {
      console.error('Error updating settings:', error);
      setStatusMessage('Unable to update overview right now.');
    }
  };

  const orderedPoints = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    if (!sorted.length) return [];
    const today = new Date();
    const lastRecorded = new Date(sorted[sorted.length - 1].date + 'T00:00:00');
    if (lastRecorded < today) {
      const filler: PortfolioSnapshot[] = [];
      const lastValue = sorted[sorted.length - 1].value;
      const cursor = new Date(lastRecorded);
      cursor.setDate(cursor.getDate() + 1);
      while (cursor <= today) {
        filler.push({ date: cursor.toISOString().slice(0, 10), value: lastValue });
        cursor.setDate(cursor.getDate() + 1);
      }
      return [...sorted, ...filler];
    }
    return sorted;
  }, [snapshots]);

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
  const bulkPreview = useMemo(
    () => holdingsImport.parseHoldingsCsv(bulkText),
    [bulkText]
  );
  const filteredHoldings = useMemo(() => {
    if (!holdingsQuery.trim()) return holdings;
    const query = holdingsQuery.trim().toLowerCase();
    return holdings.filter(
      holding =>
        holding.ticker.toLowerCase().includes(query) ||
        holding.label?.toLowerCase().includes(query)
    );
  }, [holdings, holdingsQuery]);
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

  return (
    <>
      <div className="bg-grid"></div>
      <div className="bg-noise"></div>

      <header className="site-header">
        <div className="logo">
          Investing<span className="logo-dot">·</span><span className="logo-sub">Garden</span>
        </div>
        <div className="header-actions">
          <nav className="nav">
            <button
              className={`nav-link ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveSection('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-link ${activeSection === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveSection('journal')}
            >
              Journal
            </button>
            <button
              className={`nav-link ${activeSection === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveSection('knowledge')}
            >
              Knowledge
            </button>
            <button
              className={`nav-link ${activeSection === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveSection('stats')}
            >
              Stats
            </button>
          </nav>
          <AuthControls />
        </div>
      </header>

      <main className="wrapper">
        {activeSection === 'dashboard' && (
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
                {hasAdminToken && (
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
                    <div className="stat-value">{hasAdminToken ? 'Admin' : 'Visitor'}</div>
                    <div className="stat-sub">Edits {hasAdminToken ? 'enabled' : 'locked'}</div>
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
                    <button type="button" onClick={() => void loadSnapshots()}>
                      Retry snapshots
                    </button>
                  )}
                  {holdingsError && (
                    <button type="button" onClick={() => void loadHoldings()}>
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
                {hasAdminToken ? (
                  <form className="portfolio-form" onSubmit={handleAddSnapshot}>
                    <label>
                      Date
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
                    </label>
                    <label>
                      Value (USD)
                      <input
                        type="number"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
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

            <section className="holdings-section">
              <div className="holdings-header">
                <div>
                  <p className="eyebrow">Market view</p>
                  <h2>Tracked holdings</h2>
                  <p className="hero-text">
                    Add symbols you care about to monitor live prices and recent trends.
                  </p>
                </div>
                {hasAdminToken ? (
                  <form className="holdings-form" onSubmit={handleAddHolding}>
                    <label>
                      Symbol
                      <input
                        type="text"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        required
                      />
                    </label>
                    <label>
                      Label (optional)
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Core position"
                      />
                    </label>
                    <button type="submit" className="btn-primary">Add holding</button>
                  </form>
                ) : (
                  <p className="admin-hint">Enable admin mode to add holdings.</p>
                )}
              </div>
              {hasAdminToken && (
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
                      onChange={(e) => setHoldingsQuery(e.target.value)}
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
                      canEdit={hasAdminToken}
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
          </>
        )}

        <section className={`panel ${activeSection === 'journal' ? 'panel-active' : ''}`}>
          {activeSection === 'journal' && (
            <Section
              type="journal"
              title="Trade Journal"
              description="Structured trade logs with rationale, emotions, and outcomes."
            />
          )}
        </section>

        <section className={`panel ${activeSection === 'knowledge' ? 'panel-active' : ''}`}>
          {activeSection === 'knowledge' && <KnowledgeSection />}
        </section>

        <section className={`panel ${activeSection === 'stats' ? 'panel-active' : ''}`}>
          {activeSection === 'stats' && <StatsPanel />}
        </section>
      </main>

      <footer className="site-footer">
        <p>© {currentYear} Investing Garden · Built by QD</p>
        <p className="footer-sub">
          Designed for long-term portfolio reflection, not a recommendation engine.
        </p>
      </footer>

      {settingsOpen && (
        <div className="modal" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                  onChange={(e) => setSettingsDraft(prev => ({ ...prev, headline: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-summary">Summary</label>
                <textarea
                  id="overview-summary"
                  rows={4}
                  value={settingsDraft.summary}
                  onChange={(e) => setSettingsDraft(prev => ({ ...prev, summary: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="overview-focus">Focus areas (comma-separated)</label>
                <input
                  id="overview-focus"
                  type="text"
                  value={settingsDraft.focusAreas.join(', ')}
                  onChange={(e) =>
                    setSettingsDraft(prev => ({
                      ...prev,
                      focusAreas: e.target.value
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
