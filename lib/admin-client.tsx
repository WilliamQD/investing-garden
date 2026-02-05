'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ADMIN_TOKEN_KEY = 'investing-garden-admin-token';

type AdminContextValue = {
  token: string;
  isAdmin: boolean;
  setToken: (value: string) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
  });

  const setToken = useCallback((value: string) => {
    setTokenState(value);
    if (typeof window === 'undefined') return;
    if (value) {
      localStorage.setItem(ADMIN_TOKEN_KEY, value);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      token,
      isAdmin: Boolean(token),
      setToken,
    }),
    [token, setToken]
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

export function getStoredAdminToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
}
