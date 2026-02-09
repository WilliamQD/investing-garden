'use client';

import { useMemo, useState } from 'react';
import { useAdmin } from '@/lib/admin-client';
import { ApiError } from '@/lib/data/client';
import { downloadBackup, restoreBackup, useStats } from '@/lib/data/stats';

const HEATMAP_DAYS = 56;

export default function StatsPanel() {
  const [backupMessage, setBackupMessage] = useState('');
  const { canWrite } = useAdmin();
  const { stats, isLoading, errorMessage, mutate } = useStats();

  const winRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.outcomes.win + stats.outcomes.loss + stats.outcomes.flat;
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
    for (let i = HEATMAP_DAYS - 1; i >= 0; i -= 1) {
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
    setBackupMessage('Preparing backup...');
    try {
      if (!canWrite) {
        setBackupMessage('Enter the admin token to export backups.');
        return;
      }
      const blob = await downloadBackup(format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.download = `investing-garden-backup-${dateStamp}.${format === 'zip' ? 'zip' : 'json'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setBackupMessage('Backup downloaded.');
    } catch (error) {
      setBackupMessage(
        error instanceof ApiError ? error.message : 'Backup failed. Check authentication.'
      );
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupMessage('Restoring backup...');
    try {
      if (!canWrite) {
        setBackupMessage('Enter the admin token to restore backups.');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      await restoreBackup(formData);
      setBackupMessage('Restore complete. Refreshing stats...');
      await mutate();
    } catch (error) {
      setBackupMessage(
        error instanceof ApiError ? error.message : 'Restore failed. Check the file format.'
      );
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

      {isLoading && <p className="loading-message">Loading analytics...</p>}
      {!isLoading && errorMessage && <p className="auth-message">{errorMessage}</p>}

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
                <button className="btn-secondary" onClick={() => handleExport('json')} disabled={!canWrite}>
                  Export JSON
                </button>
                <button className="btn-secondary" onClick={() => handleExport('zip')} disabled={!canWrite}>
                  Export ZIP
                </button>
                <label className="file-upload">
                  <input
                    type="file"
                    accept=".json,.zip"
                    onChange={handleRestore}
                    disabled={!canWrite}
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
