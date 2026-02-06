'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';

export default function AuthControls() {
  const { token, hasAdminToken, setToken } = useAdmin();
  const [draftToken, setDraftToken] = useState(token);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setDraftToken(token);
  }, [token]);

  const handleSave = () => {
    setToken(draftToken.trim());
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftToken('');
    setToken('');
    setIsOpen(false);
  };

  return (
    <div className="auth-controls">
      <button
        className={`auth-toggle ${hasAdminToken ? 'auth-toggle-active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
      >
        <span className={`auth-dot ${hasAdminToken ? 'auth-dot-active' : ''}`} />
        {hasAdminToken ? 'Admin' : 'Visitor'}
      </button>
      {isOpen && (
        <div className="auth-popover">
          <div className="auth-popover-header">
            <div>
              <p className="auth-title">Admin access</p>
              <p className="auth-caption">
                Enter a token to unlock edits and data entry.
              </p>
            </div>
            <button
              className="auth-close"
              onClick={() => setIsOpen(false)}
              type="button"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="auth-status">
            <p className="auth-status-title">
              {hasAdminToken ? 'Admin mode active' : 'Visitor mode'}
            </p>
            <p className="auth-status-sub">
              Edits {hasAdminToken ? 'enabled' : 'locked'} · Token stays in this browser session only.
            </p>
          </div>
          <label className="auth-label">
            <span>Admin token</span>
            <input
              className="auth-input"
              type="password"
              placeholder="Paste token"
              value={draftToken}
              onChange={event => setDraftToken(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="auth-actions">
            <button className="auth-button" onClick={handleSave} type="button">
              {hasAdminToken ? 'Update' : 'Activate'}
            </button>
            {hasAdminToken && (
              <button className="auth-button auth-button-ghost" onClick={handleClear} type="button">
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
