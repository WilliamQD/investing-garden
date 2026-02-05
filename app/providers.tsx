'use client';

import { AdminProvider } from '@/lib/admin-client';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
