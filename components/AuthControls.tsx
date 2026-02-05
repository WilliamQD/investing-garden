'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';

export default function AuthControls() {
  const { token, isAdmin, setToken } = useAdmin();
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
        {isAdmin ? 'Admin access enabled' : 'Read-only mode'}
      </span>
      <input
        className="auth-input"
        type="password"
        placeholder="Admin token"
        value={draftToken}
        onChange={event => setDraftToken(event.target.value)}
      />
      <button className="auth-button" onClick={handleSave}>
        Save
      </button>
      {isAdmin && (
        <button className="auth-button" onClick={handleClear}>
          Clear
        </button>
      )}
    </div>
  );
}
