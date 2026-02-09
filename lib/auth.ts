import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const MIN_SECRET_LENGTH = 16;
const SESSION_COOKIE_NAME = 'investing_garden_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const loginWindowMs = 1000 * 60 * 15;
const maxLoginAttempts = 10;

const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

type AdminCredential = {
  username: string;
  password: string;
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
  return { username, password };
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
  return [{ username: 'admin', password: fallbackToken }];
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

const toSessionCookie = (username: string, expiresAt: number) => {
  const payload = `${username}:${expiresAt}`;
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

  const [username, expiresAtText] = payload.split(':');
  const expiresAt = Number(expiresAtText);
  if (!username || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Date.now()) return null;
  return { username, expiresAt };
};

const getRequestIp = async () => {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headerList.get('x-real-ip') || 'unknown';
};

export const isLoginRateLimited = async () => {
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

export const verifyCredentials = (username: string, password: string) => {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) return false;
  return adminCredentials.some(credential => {
    if (!safeEquals(credential.username, normalizedUsername)) {
      return false;
    }
    return safeEquals(credential.password, password);
  });
};

export const createSessionCookieValue = (username: string) => {
  if (!canIssueSession) return null;
  return toSessionCookie(username.trim(), Date.now() + SESSION_TTL_MS);
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

export const getAuthorizedSession = async () => {
  const cookieSession = await getCookieSession();
  if (cookieSession) {
    return { isAdmin: true, username: cookieSession.username };
  }

  const token = await getHeaderToken();
  if (!token) return null;
  const matchesTokenCredential = adminCredentials.some(credential => safeEquals(credential.password, token));
  if (!matchesTokenCredential) return null;
  return { isAdmin: true, username: 'header-admin' };
};

export const getSessionCookieName = () => SESSION_COOKIE_NAME;
