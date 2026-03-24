'use client';

import { useState } from 'react';
import { useAdmin } from '@/lib/admin-client';
import { ApiError } from '@/lib/data/client';
import { downloadBackup, restoreBackup } from '@/lib/data/stats';

export default function BackupRestore() {
  const [backupMessage, setBackupMessage] = useState('');
  const { canWrite } = useAdmin();

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
      setBackupMessage('Restore complete.');
    } catch (error) {
      setBackupMessage(
        error instanceof ApiError ? error.message : 'Restore failed. Check the file format.'
      );
    }
  };

  return (
    <section className="backup-section">
      <div className="backup-header">
        <div>
          <p className="eyebrow">Data management</p>
          <h2>Backup & restore</h2>
          <p className="hero-text">
            Export data to JSON or ZIP. Restore a backup to repopulate the database.
          </p>
        </div>
      </div>
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
    </section>
  );
}
