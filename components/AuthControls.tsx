'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';

export default function AuthControls() {
  const { canWrite, isAuthenticated, role, username, login, logout, loading } = useAdmin();
  const [draftUsername, setDraftUsername] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  useEffect(() => {
    const checkOidcStatus = async () => {
      try {
        const response = await fetch('/api/oidc/status');
        if (!response.ok) {
          setOidcEnabled(false);
          return;
        }
        const data = await response.json();
        setOidcEnabled(Boolean(data?.enabled));
      } catch {
        setOidcEnabled(false);
      }
    };
    void checkOidcStatus();
  }, []);

  const handleLogin = async () => {
    setSubmitting(true);
    setStatus('');
    const result = await login(draftUsername, draftPassword);
    if (!result.ok) {
      setStatus(result.error ?? 'Authentication failed.');
      setSubmitting(false);
      return;
    }
    setDraftPassword('');
    setIsOpen(false);
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await logout();
    setDraftPassword('');
    setStatus('');
    setIsOpen(false);
  };

  return (
    <div className="auth-controls">
      <button
        className={`auth-toggle ${isAuthenticated ? 'auth-toggle-active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
        disabled={loading}
      >
        <span className={`auth-dot ${isAuthenticated ? 'auth-dot-active' : ''}`} />
        {canWrite ? 'Admin' : isAuthenticated ? 'Viewer' : 'Visitor'}
      </button>
      {isOpen && (
        <div className="auth-popover">
          <div className="auth-popover-header">
            <div>
              <p className="auth-title">Admin access</p>
              <p className="auth-caption">
                Sign in with approved credentials to unlock edit permissions.
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
              {canWrite ? 'Admin mode active' : isAuthenticated ? 'Signed in (read-only)' : 'Visitor mode'}
            </p>
            <p className="auth-status-sub">
              {canWrite
                ? `Logged in as ${username || 'admin'} · edits enabled.`
                : isAuthenticated
                  ? `Signed in as ${username || 'user'} · role ${role || 'viewer'}.`
                : 'Read-only mode. Sign in to edit.'}
            </p>
          </div>

          {!isAuthenticated && (
            <>
              <label className="auth-label">
                <span>Username</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Username"
                  value={draftUsername}
                  onChange={event => setDraftUsername(event.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="auth-label">
                <span>Password</span>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Password"
                  value={draftPassword}
                  onChange={event => setDraftPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            </>
          )}

          {status && <p className="auth-status-sub">{status}</p>}

          <div className="auth-actions">
            {!isAuthenticated ? (
              <>
                <button className="auth-button" onClick={handleLogin} type="button" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
                {oidcEnabled && (
                  <button
                    className="auth-button auth-button-ghost"
                    onClick={() => {
                      window.location.href = '/api/oidc/signin';
                    }}
                    type="button"
                  >
                    Use SSO
                  </button>
                )}
              </>
            ) : (
              <button className="auth-button auth-button-ghost" onClick={handleLogout} type="button">
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
