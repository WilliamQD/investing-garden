'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AdminContextValue = {
  token: string;
  hasAdminToken: boolean;
  authHeaders: Record<string, string>;
  setToken: (value: string) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem('adminToken') ?? '';
  });

  const setToken = useCallback((value: string) => {
    setTokenState(value);
    if (typeof window === 'undefined') return;
    if (value) {
      window.sessionStorage.setItem('adminToken', value);
    } else {
      window.sessionStorage.removeItem('adminToken');
    }
  }, []);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['x-admin-token'] = token;
    }
    return headers;
  }, [token]);

  const contextValue = useMemo(
    () => ({
      token,
      hasAdminToken: Boolean(token),
      authHeaders,
      setToken,
    }),
    [authHeaders, token, setToken]
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
