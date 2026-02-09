import 'server-only';

import { getServerSession } from 'next-auth';

import { authOptions, isOidcConfigured } from '@/lib/auth-config';

type OidcSession = {
  username: string;
  role: string;
};

export const getOidcSession = async (): Promise<OidcSession | null> => {
  if (!isOidcConfigured) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const username =
    typeof session.user.name === 'string'
      ? session.user.name
      : typeof session.user.email === 'string'
        ? session.user.email
        : 'oidc-user';
  const rawRole = (session.user as { role?: string }).role;
  const role = typeof rawRole === 'string' ? rawRole : 'viewer';
  return { username, role };
};
