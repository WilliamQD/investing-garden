'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';

export default function AuthControls() {
  const { token, hasAdminToken, setToken } = useAdmin();
  const [draftToken, setDraftToken] = useState(token);

  useEffect(() => {
    setDraftToken(token);
  }, [token]);

  const handleSave = () => {
    setToken(draftToken.trim());
  };

  const handleClear = () => {
    setDraftToken('');
    setToken('');
  };

  return (
    <div className="auth-controls">
      <span className="auth-status">
        {hasAdminToken
          ? 'Admin token active (refresh clears)'
          : 'Read-only mode (token required each session)'}
      </span>
      <label className="auth-label">
        <span>Admin token</span>
        <input
          className="auth-input"
          type="password"
          placeholder="Admin token"
          value={draftToken}
          onChange={event => setDraftToken(event.target.value)}
          autoComplete="off"
        />
      </label>
      <button className="auth-button" onClick={handleSave}>
        Save
      </button>
      {hasAdminToken && (
        <button className="auth-button" onClick={handleClear}>
          Clear
        </button>
      )}
    </div>
  );
}
