'use client';

import { SWRConfig } from 'swr';

import { AdminProvider } from '@/lib/admin-client';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          errorRetryCount: 3,
          errorRetryInterval: 2000,
        }}
      >
        {children}
      </SWRConfig>
    </AdminProvider>
  );
}
