import 'server-only';

import { headers } from 'next/headers';

const adminToken = process.env.ADMIN_TOKEN;

const getTokenFromHeaders = async () => {
  const headerList = await headers();
  const bearer = headerList.get('authorization');
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    return bearer.slice(7).trim();
  }
  return headerList.get('x-admin-token')?.trim() ?? '';
};

export const getAuthorizedSession = async () => {
  if (!adminToken) return null;
  const token = await getTokenFromHeaders();
  if (!token || token !== adminToken) return null;
  return { isAdmin: true };
};
