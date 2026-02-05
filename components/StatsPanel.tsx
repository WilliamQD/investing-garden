'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type DailyCount = { date: string; count: number };
type TagCount = { tag: string; count: number };

interface StatsPayload {
  totals: { journal: number; learning: number; resources: number };
  outcomes: { win: number; loss: number; flat: number; open: number };
  dailyJournal: DailyCount[];
  activity: DailyCount[];
  topTags: TagCount[];
}

export default function StatsPanel() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupMessage, setBackupMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
          setErrorMessage('Analytics are unavailable. Check your database connection.');
          setStats(null);
          return;
        }
        const data = await response.json();
        if (!data?.outcomes) {
          setErrorMessage('Analytics are unavailable. Check your database connection.');
          setStats(null);
          return;
        }
        setStats(data);
        setErrorMessage('');
      } catch (error) {
        console.error('Failed to load stats', error);
        setErrorMessage('Analytics are unavailable. Check your database connection.');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const winRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.outcomes.win + stats.outcomes.loss + stats.outcomes.flat + stats.outcomes.open;
    return total ? (stats.outcomes.win / total) * 100 : 0;
  }, [stats]);

  const recentJournal = useMemo(() => {
    if (!stats) return [];
    return stats.dailyJournal.slice(-7);
  }, [stats]);

  const heatmapCells = useMemo(() => {
    const getHeatmapLevel = (count: number) => {
      if (count === 0) return 0;
      if (count < 2) return 1;
      if (count < 4) return 2;
      if (count < 6) return 3;
      return 4;
    };
    const activityMap = new Map(
      (stats?.activity ?? []).map(item => [item.date, item.count])
    );
    const cells: { date: string; count: number; level: number }[] = [];
    for (let i = 55; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const count = activityMap.get(key) ?? 0;
      const level = getHeatmapLevel(count);
      cells.push({ date: key, count, level });
    }
    return cells;
  }, [stats]);

  const handleExport = async (format: 'json' | 'zip') => {
    if (!isAuthenticated) {
      setBackupMessage('Sign in to export backups.');
      return;
    }
    setBackupMessage('Preparing backup...');
    const response = await fetch(`/api/backup?format=${format}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      setBackupMessage('Backup failed. Check authentication.');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `investing-garden-backup.${format === 'zip' ? 'zip' : 'json'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setBackupMessage('Backup downloaded.');
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAuthenticated) {
      setBackupMessage('Sign in to restore backups.');
      return;
    }
    setBackupMessage('Restoring backup...');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/backup', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!response.ok) {
      setBackupMessage('Restore failed. Check the file format.');
      return;
    }
    setBackupMessage('Restore complete. Refreshing stats...');
    const refreshed = await fetch('/api/stats');
    if (refreshed.ok) {
      const data = await refreshed.json();
      setStats(data);
      setErrorMessage('');
    }
  };

  return (
    <div className="stats-panel">
      <div className="panel-header panel-stats">
        <div>
          <p className="eyebrow-alt">📈 Stats</p>
          <h2>Analytics Dashboard</h2>
          <p>Live insights across journal, learning, and resource activity.</p>
          <p className="panel-sub">Track outcomes, momentum, and topical focus at a glance.</p>
        </div>
      </div>

      {loading && <p className="loading-message">Loading analytics...</p>}
      {!loading && errorMessage && <p className="auth-message">{errorMessage}</p>}

      {stats && (
        <>
          <div className="stats-grid">
            <div className="stats-card">
              <p className="stat-label">Journal entries</p>
              <p className="stat-value">{stats.totals.journal}</p>
            </div>
            <div className="stats-card">
              <p className="stat-label">Learning notes</p>
              <p className="stat-value">{stats.totals.learning}</p>
            </div>
            <div className="stats-card">
              <p className="stat-label">Resources</p>
              <p className="stat-value">{stats.totals.resources}</p>
            </div>
            <div className="stats-card">
              <p className="stat-label">Win rate</p>
              <p className="stat-value">{winRate.toFixed(1)}%</p>
              <p className="stat-sub">
                {stats.outcomes.win}W · {stats.outcomes.loss}L · {stats.outcomes.flat}F · {stats.outcomes.open}O
              </p>
            </div>
          </div>

          <div className="stats-row">
            <div className="stats-section">
              <h3>Journal momentum</h3>
              <ul className="stats-list">
                {recentJournal.map(day => (
                  <li key={day.date}>
                    <span>{day.date}</span>
                    <span>{day.count} entries</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="stats-section">
              <h3>Top tags</h3>
              <ul className="stats-list">
                {stats.topTags.length === 0 && <li>No tags recorded yet.</li>}
                {stats.topTags.map(tag => (
                  <li key={tag.tag}>
                    <span>{tag.tag}</span>
                    <span>{tag.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="stats-section">
            <h3>Contribution heatmap</h3>
            <div className="heatmap-grid">
              {heatmapCells.map(cell => (
                <span
                  key={cell.date}
                  className={`heatmap-cell heatmap-level-${cell.level}`}
                  title={`${cell.date}: ${cell.count} entries`}
                />
              ))}
            </div>
          </div>

          <div className="stats-section backup-panel">
            <h3>Backup & restore</h3>
            <p className="panel-sub">
              Export data to JSON or ZIP. Restore a backup to repopulate the database.
            </p>
            <div className="backup-actions">
              <button className="btn-secondary" onClick={() => handleExport('json')} disabled={!isAuthenticated}>
                Export JSON
              </button>
              <button className="btn-secondary" onClick={() => handleExport('zip')} disabled={!isAuthenticated}>
                Export ZIP
              </button>
              <label className="file-upload">
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={handleRestore}
                  disabled={!isAuthenticated}
                />
                Restore from file
              </label>
            </div>
            {backupMessage && <p className="auth-message">{backupMessage}</p>}
          </div>
        </>
      )}
    </div>
  );
}
