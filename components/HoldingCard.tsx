'use client';

import { useEffect, useState } from 'react';

import MarketPrice from './MarketPrice';
import MarketSparkline from './MarketSparkline';

type Holding = {
  id: string;
  ticker: string;
  label?: string;
};

interface HoldingCardProps {
  holding: Holding;
  canEdit: boolean;
  onRemove: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => Promise<void>;
}

export default function HoldingCard({ holding, canEdit, onRemove, onUpdateLabel }: HoldingCardProps) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(holding.label ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDraftLabel(holding.label ?? '');
  }, [holding.label]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage('');
      await onUpdateLabel(holding.id, draftLabel);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update holding label', error);
      setErrorMessage('Unable to update label.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="holding-card">
      <div className="holding-header">
        <div>
          <p className="holding-ticker">{holding.ticker}</p>
          {isEditing ? (
            <div className="holding-edit">
              <label>
                Label
                <input
                  type="text"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  placeholder="Optional label"
                  aria-label={`Edit label for ${holding.ticker}`}
                />
              </label>
              {errorMessage && <p className="holding-edit-error">{errorMessage}</p>}
              <div className="holding-edit-actions">
                <button
                  className="holding-edit-save"
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="holding-edit-cancel"
                  type="button"
                  onClick={() => {
                    setDraftLabel(holding.label ?? '');
                    setErrorMessage('');
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`holding-label${holding.label ? '' : ' holding-label-muted'}`}>
              {holding.label || 'No label yet'}
            </p>
          )}
        </div>
        <div className="holding-actions">
          <button
            className="holding-refresh"
            onClick={() => setRefreshToken(prev => prev + 1)}
            type="button"
            title={`Refresh ${holding.ticker} market data`}
            aria-label={`Refresh ${holding.ticker} market data`}
            disabled={isSaving}
          >
            Refresh
          </button>
          {canEdit && (
            <>
              <button
                className="holding-edit-toggle"
                onClick={() => {
                  setDraftLabel(holding.label ?? '');
                  setErrorMessage('');
                  setIsEditing(prev => !prev);
                }}
                type="button"
                disabled={isSaving}
              >
                {isEditing ? 'Close' : 'Edit label'}
              </button>
              <button
                className="holding-remove"
                onClick={() => onRemove(holding.id)}
                type="button"
                disabled={isSaving}
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <MarketPrice ticker={holding.ticker} refreshToken={refreshToken} />
      <MarketSparkline ticker={holding.ticker} refreshToken={refreshToken} />
    </article>
  );
}
