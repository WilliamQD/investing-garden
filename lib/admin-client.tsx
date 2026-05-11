'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AdminContextValue = {
  isAuthenticated: boolean;
  canWrite: boolean;
  username: string;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (!response.ok) {
        setIsAuthenticated(false);
        setCanWrite(false);
        setUsername('');
        return;
      }
      const data = await response.json();
      setIsAuthenticated(Boolean(data.isAuthenticated));
      setCanWrite(Boolean(data.canWrite));
      setUsername(typeof data.username === 'string' ? data.username : '');
    } catch {
      setIsAuthenticated(false);
      setCanWrite(false);
      setUsername('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (nextUsername: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextUsername, password }),
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'Unable to authenticate.',
        };
      }
      setIsAuthenticated(true);
      setCanWrite(Boolean(data.canWrite));
      setUsername(typeof data.username === 'string' ? data.username : nextUsername);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to authenticate.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setIsAuthenticated(false);
      setCanWrite(false);
      setUsername('');
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      isAuthenticated,
      canWrite,
      username,
      login,
      logout,
      loading,
    }),
    [canWrite, isAuthenticated, loading, login, logout, username]
  );

  return <AdminContext.Provider value={contextValue}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
