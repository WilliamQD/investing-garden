import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { verifyPassword } from './password-utils';


const MIN_SECRET_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 8;
const SESSION_COOKIE_NAME = 'investing_garden_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_ROTATION_THRESHOLD_MS = 1000 * 60 * 60;
export const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const loginWindowMs = 1000 * 60 * 15;
const maxLoginAttempts = 10;
const MAX_LOGIN_ATTEMPTS_MAP_SIZE = 1000;

const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

type Role = 'admin' | 'editor' | 'viewer';

type AdminCredential = {
  username: string;
  password: string;
  role: Role;
};

const ROLE_PERMISSIONS: Record<Role, { canWrite: boolean }> = {
  admin: { canWrite: true },
  editor: { canWrite: true },
  viewer: { canWrite: false },
};

const normalizeRole = (value: unknown, fallback: Role = 'viewer'): Role => {
  if (value === 'admin' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return fallback;
};

const normalizeCredential = (credential: unknown): AdminCredential | null => {
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
    return null;
  }
  const username = typeof (credential as AdminCredential).username === 'string'
    ? (credential as AdminCredential).username.trim()
    : '';
  const password = typeof (credential as AdminCredential).password === 'string'
    ? (credential as AdminCredential).password
    : '';
  if (!username || !password) return null;
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.warn(`Admin credential for "${username}" has password shorter than ${MIN_PASSWORD_LENGTH} characters; skipping.`);
    return null;
  }
  const role = normalizeRole((credential as AdminCredential).role, 'admin');
  return { username, password, role };
};

const parseCredentialList = (): AdminCredential[] => {
  const rawList = process.env.ADMIN_CREDENTIALS;
  if (rawList) {
    try {
      const parsed = JSON.parse(rawList);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeCredential)
        .filter((credential): credential is AdminCredential => Boolean(credential));
    } catch {
      console.warn('ADMIN_CREDENTIALS is not valid JSON; falling back to ADMIN_TOKEN if provided.');
    }
  }

  const fallbackToken = process.env.ADMIN_TOKEN ?? '';
  if (!fallbackToken) return [];
  if (fallbackToken.length < MIN_PASSWORD_LENGTH) {
    console.warn(`ADMIN_TOKEN is shorter than ${MIN_PASSWORD_LENGTH} characters; write actions disabled.`);
    return [];
  }
  return [{ username: 'admin', password: fallbackToken, role: 'admin' }];
};

const adminCredentials = parseCredentialList();
if (!adminCredentials.length) {
  console.warn('No admin credentials configured. Write actions are disabled.');
}

const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_TOKEN ?? '';
if (sessionSecret && sessionSecret.length < MIN_SECRET_LENGTH) {
  throw new Error(`ADMIN_SESSION_SECRET (or ADMIN_TOKEN fallback) must be at least ${MIN_SECRET_LENGTH} characters.`);
}

const canIssueSession = sessionSecret.length >= MIN_SECRET_LENGTH;

const signSession = (value: string) =>
  createHmac('sha256', sessionSecret).update(value).digest('hex');

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const toSessionCookie = (username: string, role: Role, expiresAt: number) => {
  const payload = `${username}:${role}:${expiresAt}`;
  const signature = signSession(payload);
  return `${payload}:${signature}`;
};

const parseSessionCookie = (value: string) => {
  const lastSeparator = value.lastIndexOf(':');
  if (lastSeparator === -1) return null;
  const payload = value.slice(0, lastSeparator);
  const signature = value.slice(lastSeparator + 1);
  if (!payload || !signature) return null;
  const expectedSignature = signSession(payload);
  if (!safeEquals(signature, expectedSignature)) return null;

  const parts = payload.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [username, roleOrExpires, expiresAtText] = parts;
  const role = parts.length === 3 ? normalizeRole(roleOrExpires) : 'viewer';
  const expiresAt = Number(parts.length === 3 ? expiresAtText : roleOrExpires);
  if (!username || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Date.now()) return null;
  return { username, role, expiresAt };
};

const validateIpAddress = (ip: string): string | null => {
  // Basic IPv4 validation
  // Note: IPv6 validation is intentionally simplified and may not catch all edge cases
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-f:]+$/i;
  
  if (!ip || ip === 'unknown') return null;
  
  // Limit length to prevent abuse
  if (ip.length > 45) return null; // Max IPv6 length is 45
  
  if (ipv4Regex.test(ip)) {
    // Validate IPv4 octets are 0-255 and reject leading zeros
    const octets = ip.split('.');
    if (octets.every(octet => {
      // Reject leading zeros (except '0' itself)
      if (octet.length > 1 && octet[0] === '0') return false;
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    })) {
      return ip;
    }
  }
  
  // Basic IPv6 check: contains colons and only hex characters
  if (ip.includes(':') && ipv6Regex.test(ip) && ip.split(':').length >= 3) {
    return ip;
  }
  
  return null;
};

const evictOldLoginAttempts = () => {
  if (loginAttempts.size <= MAX_LOGIN_ATTEMPTS_MAP_SIZE) return;
  
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, attempt] of loginAttempts.entries()) {
    if (now - attempt.firstAttemptAt > loginWindowMs) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    loginAttempts.delete(key);
  }
  
  // If still too large, delete oldest entries
  if (loginAttempts.size > MAX_LOGIN_ATTEMPTS_MAP_SIZE) {
    const entries = Array.from(loginAttempts.entries())
      .sort((a, b) => a[1].firstAttemptAt - b[1].firstAttemptAt);
    const toRemove = entries.slice(0, loginAttempts.size - MAX_LOGIN_ATTEMPTS_MAP_SIZE);
    for (const [key] of toRemove) {
      loginAttempts.delete(key);
    }
  }
};

export const getRequestIp = async () => {
  const headerList = await headers();
  
  // Only trust forwarded headers in production or if explicitly enabled
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';
  
  if (trustProxy) {
    const forwarded = headerList.get('x-forwarded-for');
    if (forwarded) {
      const firstIp = forwarded.split(',')[0]?.trim() || '';
      const validated = validateIpAddress(firstIp);
      if (validated) return validated;
    }
    
    const realIp = headerList.get('x-real-ip');
    if (realIp) {
      const validated = validateIpAddress(realIp.trim());
      if (validated) return validated;
    }
  }
  
  return 'unknown';
};

export const isLoginRateLimited = async () => {
  evictOldLoginAttempts();
  const ip = await getRequestIp();
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;
  if (Date.now() - attempt.firstAttemptAt > loginWindowMs) {
    loginAttempts.delete(ip);
    return false;
  }
  return attempt.count >= maxLoginAttempts;
};

export const registerFailedLogin = async () => {
  evictOldLoginAttempts();
  const ip = await getRequestIp();
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || now - attempt.firstAttemptAt > loginWindowMs) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: now });
    return;
  }
  attempt.count += 1;
  loginAttempts.set(ip, attempt);
};

export const clearLoginAttempts = async () => {
  const ip = await getRequestIp();
  loginAttempts.delete(ip);
};

export const verifyCredentials = async (username: string, password: string) => {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) return null;

  for (const credential of adminCredentials) {
    if (safeEquals(credential.username, normalizedUsername)) {
      const isValid = await verifyPassword(password, credential.password);
      if (isValid) {
        return { username: credential.username, role: credential.role };
      }
    }
  }
  return null;
};

export const createSessionCookieValue = (username: string, role: Role) => {
  if (!canIssueSession) return null;
  return toSessionCookie(username.trim(), normalizeRole(role, 'viewer'), Date.now() + SESSION_TTL_MS);
};

export const clearSessionCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
};

const getCookieSession = async () => {
  if (!canIssueSession) return null;
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawSession) return null;
  return parseSessionCookie(rawSession);
};

const getHeaderToken = async () => {
  const headerList = await headers();
  return headerList.get('x-admin-token')?.trim() ?? '';
};

const getRolePermissions = (role: Role) => ROLE_PERMISSIONS[normalizeRole(role)];

export const getRolePermissionsForRole = (role: Role) => getRolePermissions(role);

export const getAuthorizedSession = async () => {
  const cookieSession = await getCookieSession();
  if (cookieSession) {
    const permissions = getRolePermissions(cookieSession.role);
    return {
      isAuthenticated: true,
      username: cookieSession.username,
      role: cookieSession.role,
      canWrite: permissions.canWrite,
      expiresAt: cookieSession.expiresAt,
      source: 'cookie' as const,
    };
  }

  const token = await getHeaderToken();
  if (!token) return null;
  const matchesTokenCredential = adminCredentials.find(credential =>
    safeEquals(credential.password, token)
  );
  if (!matchesTokenCredential) return null;
  const permissions = getRolePermissions(matchesTokenCredential.role);
  return {
    isAuthenticated: true,
    username: matchesTokenCredential.username || 'header-admin',
    role: matchesTokenCredential.role,
    canWrite: permissions.canWrite,
    expiresAt: null,
    source: 'header' as const,
  };
};

export const requireWriteAccess = async () => {
  const session = await getAuthorizedSession();
  if (!session?.canWrite) return null;
  return session;
};

export const getSessionRotationCookie = (session: Awaited<ReturnType<typeof getAuthorizedSession>>) => {
  if (!session || session.source !== 'cookie') return null;
  if (!session.expiresAt) return null;
  if (session.expiresAt - Date.now() > SESSION_ROTATION_THRESHOLD_MS) {
    return null;
  }
  return createSessionCookieValue(session.username, session.role);
};

export const getSessionCookieName = () => SESSION_COOKIE_NAME;
