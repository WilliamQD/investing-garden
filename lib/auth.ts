import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';

const MIN_ADMIN_TOKEN_LENGTH = 16;
const adminToken = process.env.ADMIN_TOKEN ?? '';

if (!adminToken) {
  console.warn('ADMIN_TOKEN is not set. Write actions are disabled.');
} else if (adminToken.length < MIN_ADMIN_TOKEN_LENGTH) {
  throw new Error(`ADMIN_TOKEN must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters.`);
}

const adminTokenHash =
  adminToken.length >= MIN_ADMIN_TOKEN_LENGTH
    ? createHash('sha256').update(adminToken).digest()
    : null;

const getTokenFromHeaders = async () => {
  const headerList = await headers();
  return headerList.get('x-admin-token')?.trim() ?? '';
};

const tokensMatch = (token: string) => {
  if (!token || !adminTokenHash) return false;
  const tokenHash = createHash('sha256').update(token).digest();
  return timingSafeEqual(tokenHash, adminTokenHash);
};

export const getAuthorizedSession = async () => {
  if (!adminTokenHash) return null;
  const token = await getTokenFromHeaders();
  if (!tokensMatch(token)) return null;
  return { isAdmin: true };
};
