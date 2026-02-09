/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHmac, timingSafeEqual } = require('node:crypto');

/**
 * These tests focus on the core authentication logic that can be tested
 * without mocking Next.js server-only modules. We test:
 * - Credential parsing and normalization logic
 * - Session cookie signing and validation
 * - Timing-safe string comparison
 * - Constants and exports
 */

// Helper for timing-safe comparison (mirrors lib/auth.ts)
const safeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

// Helper to create a valid session cookie (mirrors lib/auth.ts)
const createTestSessionCookie = (username, role, expiresAt, secret) => {
  const payload = `${username}:${role}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}:${signature}`;
};

// Helper to parse session cookie (mirrors lib/auth.ts)
const parseSessionCookie = (value, secret) => {
  const lastSeparator = value.lastIndexOf(':');
  if (lastSeparator === -1) return null;
  const payload = value.slice(0, lastSeparator);
  const signature = value.slice(lastSeparator + 1);
  if (!payload || !signature) return null;
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
  if (!safeEquals(signature, expectedSignature)) return null;

  const parts = payload.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [username, roleOrExpires, expiresAtText] = parts;
  const role = parts.length === 3 ? roleOrExpires : 'admin';
  const expiresAt = Number(parts.length === 3 ? expiresAtText : roleOrExpires);
  if (!username || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Date.now()) return null;
  return { username, role, expiresAt };
};

// Helper to normalize credential (mirrors lib/auth.ts)
const normalizeCredential = (credential, minPasswordLength = 8) => {
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
    return null;
  }
  const username = typeof credential.username === 'string'
    ? credential.username.trim()
    : '';
  const password = typeof credential.password === 'string'
    ? credential.password
    : '';
  const role = credential.role === 'admin' || credential.role === 'editor' || credential.role === 'viewer'
    ? credential.role
    : 'admin';
  if (!username || !password) return null;
  if (password.length < minPasswordLength) {
    return null;
  }
  return { username, password, role };
};

// Helper to validate IP address (mirrors lib/auth.ts)
const validateIpAddress = (ip) => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^[0-9a-f:]+$/i;
  
  if (!ip || ip === 'unknown') return null;
  if (ip.length > 45) return null;
  
  if (ipv4Regex.test(ip)) {
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

test('normalizeCredential accepts valid credentials', () => {
  const result = normalizeCredential({
    username: 'testuser',
    password: 'password123',
  });
  
  assert.deepEqual(result, {
    username: 'testuser',
    password: 'password123',
    role: 'admin',
  });
});

test('normalizeCredential trims username whitespace', () => {
  const result = normalizeCredential({
    username: '  testuser  ',
    password: 'password123',
  });
  
  assert.equal(result.username, 'testuser');
});

test('normalizeCredential rejects short passwords', () => {
  const result = normalizeCredential({
    username: 'testuser',
    password: 'short',
  });
  
  assert.equal(result, null);
});

test('normalizeCredential rejects empty username', () => {
  const result = normalizeCredential({
    username: '',
    password: 'password123',
  });
  
  assert.equal(result, null);
});

test('normalizeCredential rejects empty password', () => {
  const result = normalizeCredential({
    username: 'testuser',
    password: '',
  });
  
  assert.equal(result, null);
});

test('normalizeCredential rejects invalid types', () => {
  assert.equal(normalizeCredential(null), null);
  assert.equal(normalizeCredential(undefined), null);
  assert.equal(normalizeCredential([]), null);
  assert.equal(normalizeCredential('string'), null);
  assert.equal(normalizeCredential(123), null);
});

test('session cookie signing creates consistent signatures', () => {
  const secret = 'test-secret-1234567890';
  const username = 'testuser';
  const expiresAt = 1234567890000;
  
  const cookie1 = createTestSessionCookie(username, 'admin', expiresAt, secret);
  const cookie2 = createTestSessionCookie(username, 'admin', expiresAt, secret);
  
  assert.equal(cookie1, cookie2);
  assert.ok(cookie1.includes('testuser'));
  assert.ok(cookie1.includes('1234567890000'));
});

test('session cookie parsing validates signatures', () => {
  const secret = 'test-secret-1234567890';
  const username = 'testuser';
  const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour in future
  
  const cookie = createTestSessionCookie(username, 'admin', expiresAt, secret);
  const parsed = parseSessionCookie(cookie, secret);
  
  assert.ok(parsed !== null);
  assert.equal(parsed.username, 'testuser');
  assert.equal(parsed.role, 'admin');
  assert.equal(parsed.expiresAt, expiresAt);
});

test('session cookie parsing rejects tampered signatures', () => {
  const secret = 'test-secret-1234567890';
  const expiresAt = Date.now() + 1000 * 60 * 60;
  
  const payload = `testuser:admin:${expiresAt}`;
  const wrongSignature = 'wrong-signature-here';
  const tamperedCookie = `${payload}:${wrongSignature}`;
  
  const parsed = parseSessionCookie(tamperedCookie, secret);
  assert.equal(parsed, null);
});

test('session cookie parsing rejects expired sessions', () => {
  const secret = 'test-secret-1234567890';
  const username = 'testuser';
  const expiresAt = Date.now() - 1000; // 1 second in past
  
  const cookie = createTestSessionCookie(username, 'admin', expiresAt, secret);
  const parsed = parseSessionCookie(cookie, secret);
  
  assert.equal(parsed, null);
});

test('session cookie parsing rejects malformed cookies', () => {
  const secret = 'test-secret-1234567890';
  
  assert.equal(parseSessionCookie('', secret), null);
  assert.equal(parseSessionCookie('no-colons', secret), null);
  assert.equal(parseSessionCookie('only:one', secret), null);
  assert.equal(parseSessionCookie('::', secret), null);
  assert.equal(parseSessionCookie('username::signature', secret), null);
});

test('session cookie parsing validates expiration timestamp', () => {
  const secret = 'test-secret-1234567890';
  
  // Non-numeric expiration
  const payload1 = 'testuser:admin:notanumber';
  const sig1 = createHmac('sha256', secret).update(payload1).digest('hex');
  assert.equal(parseSessionCookie(`${payload1}:${sig1}`, secret), null);
  
  // Missing expiration
  const payload2 = 'testuser:admin:';
  const sig2 = createHmac('sha256', secret).update(payload2).digest('hex');
  assert.equal(parseSessionCookie(`${payload2}:${sig2}`, secret), null);
});

test('safeEquals performs timing-safe comparison', () => {
  assert.equal(safeEquals('hello', 'hello'), true);
  assert.equal(safeEquals('hello', 'world'), false);
  assert.equal(safeEquals('', ''), true);
  assert.equal(safeEquals('a', 'aa'), false);
  assert.equal(safeEquals('password123', 'password123'), true);
  assert.equal(safeEquals('password123', 'password124'), false);
});

test('validateIpAddress accepts valid IPv4 addresses', () => {
  assert.equal(validateIpAddress('192.168.1.1'), '192.168.1.1');
  assert.equal(validateIpAddress('10.0.0.1'), '10.0.0.1');
  assert.equal(validateIpAddress('255.255.255.255'), '255.255.255.255');
  assert.equal(validateIpAddress('0.0.0.0'), '0.0.0.0');
});

test('validateIpAddress rejects invalid IPv4 addresses', () => {
  assert.equal(validateIpAddress('256.1.1.1'), null); // Octet > 255
  assert.equal(validateIpAddress('192.168.1'), null); // Too few octets
  assert.equal(validateIpAddress('192.168.1.1.1'), null); // Too many octets
  assert.equal(validateIpAddress('abc.def.ghi.jkl'), null); // Non-numeric
  assert.equal(validateIpAddress('192.168.01.1'), null); // Leading zero
  assert.equal(validateIpAddress('192.168.001.1'), null); // Leading zeros
});

test('validateIpAddress accepts valid IPv6 addresses', () => {
  assert.equal(validateIpAddress('2001:0db8:85a3::8a2e:0370:7334'), '2001:0db8:85a3::8a2e:0370:7334');
  assert.equal(validateIpAddress('::1'), '::1');
  assert.equal(validateIpAddress('fe80::1'), 'fe80::1');
  assert.equal(validateIpAddress('2001:db8::8a2e:370:7334'), '2001:db8::8a2e:370:7334');
});

test('validateIpAddress rejects invalid inputs', () => {
  assert.equal(validateIpAddress(''), null);
  assert.equal(validateIpAddress('unknown'), null);
  assert.equal(validateIpAddress('not-an-ip'), null);
  assert.equal(validateIpAddress('x'.repeat(50)), null); // Too long
});

test('credential list parsing from JSON', () => {
  const rawList = JSON.stringify([
    { username: 'user1', password: 'password1' },
    { username: 'user2', password: 'password2' },
    { username: 'short', password: 'pwd' }, // Should be filtered out
    { username: '', password: 'password3' }, // Should be filtered out
  ]);
  
  const parsed = JSON.parse(rawList);
  const normalized = parsed
    .map(c => normalizeCredential(c))
    .filter(c => c !== null);
  
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].username, 'user1');
  assert.equal(normalized[1].username, 'user2');
});

test('credential verification with multiple valid credentials', () => {
  const credentials = [
    { username: 'user1', password: 'password1' },
    { username: 'user2', password: 'password2' },
  ];
  
  // Simulate verifyCredentials logic
  const verifyTest = (username, password) => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) return false;
    return credentials.some(credential => {
      if (!safeEquals(credential.username, normalizedUsername)) {
        return false;
      }
      return safeEquals(credential.password, password);
    });
  };
  
  assert.equal(verifyTest('user1', 'password1'), true);
  assert.equal(verifyTest('user2', 'password2'), true);
  assert.equal(verifyTest('user1', 'password2'), false);
  assert.equal(verifyTest('user3', 'password1'), false);
  assert.equal(verifyTest(' user1 ', 'password1'), true); // Trimmed
});

test('session TTL calculation', () => {
  const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
  const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
  
  assert.equal(SESSION_TTL_SECONDS, 43200); // 12 * 60 * 60
});

test('rate limit window behavior simulation', () => {
  const loginWindowMs = 1000 * 60 * 15; // 15 minutes
  const maxLoginAttempts = 10;
  
  const attempts = new Map();
  const ip = '192.168.1.100';
  
  // Simulate failed login tracking
  const registerFailed = (currentTime) => {
    const attempt = attempts.get(ip);
    if (!attempt || currentTime - attempt.firstAttemptAt > loginWindowMs) {
      attempts.set(ip, { count: 1, firstAttemptAt: currentTime });
      return;
    }
    attempt.count += 1;
    attempts.set(ip, attempt);
  };
  
  const isRateLimited = (currentTime) => {
    const attempt = attempts.get(ip);
    if (!attempt) return false;
    if (currentTime - attempt.firstAttemptAt > loginWindowMs) {
      attempts.delete(ip);
      return false;
    }
    return attempt.count >= maxLoginAttempts;
  };
  
  const startTime = Date.now();
  
  // Register 10 failed attempts
  for (let i = 0; i < 10; i++) {
    registerFailed(startTime);
  }
  
  assert.equal(isRateLimited(startTime), true);
  
  // After window expires, should reset
  const afterWindow = startTime + loginWindowMs + 1000;
  assert.equal(isRateLimited(afterWindow), false);
});

test('login attempts map eviction logic', () => {
  const MAX_SIZE = 100;
  const loginWindowMs = 1000 * 60 * 15;
  const attempts = new Map();
  
  // Fill map beyond limit
  const now = Date.now();
  for (let i = 0; i < 150; i++) {
    attempts.set(`ip-${i}`, { count: 1, firstAttemptAt: now - (i * 1000) });
  }
  
  assert.equal(attempts.size, 150);
  
  // Simulate eviction of old entries
  const keysToDelete = [];
  for (const [key, attempt] of attempts.entries()) {
    if (now - attempt.firstAttemptAt > loginWindowMs) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    attempts.delete(key);
  }
  
  // If still too large, delete oldest
  if (attempts.size > MAX_SIZE) {
    const entries = Array.from(attempts.entries())
      .sort((a, b) => a[1].firstAttemptAt - b[1].firstAttemptAt);
    const toRemove = entries.slice(0, attempts.size - MAX_SIZE);
    for (const [key] of toRemove) {
      attempts.delete(key);
    }
  }
  
  assert.ok(attempts.size <= MAX_SIZE);
});
