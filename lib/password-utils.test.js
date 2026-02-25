/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

// Helper for timing-safe comparison (mirrors lib/password-utils.ts)
const safeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

// Replicate hashPassword
const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

// Replicate verifyPassword
const verifyPassword = async (password, storedHash) => {
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];

    try {
      const derivedKey = await scryptAsync(password, salt, 64);
      const keyBuffer = Buffer.from(key, 'hex');
      if (keyBuffer.length !== derivedKey.length) return false;
      return timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  // Legacy plaintext fallback
  console.warn('Using legacy plaintext password verification. Please migrate to hashed passwords.');
  return safeEquals(storedHash, password);
};

test('hashPassword produces correct format', async () => {
  const hash = await hashPassword('password123');
  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
});

test('hashPassword produces different salts', async () => {
  const hash1 = await hashPassword('password123');
  const hash2 = await hashPassword('password123');
  assert.notEqual(hash1, hash2);
});

test('verifyPassword accepts correct password', async () => {
  const hash = await hashPassword('password123');
  const result = await verifyPassword('password123', hash);
  assert.equal(result, true);
});

test('verifyPassword rejects wrong password', async () => {
  const hash = await hashPassword('password123');
  const result = await verifyPassword('wrong', hash);
  assert.equal(result, false);
});

test('verifyPassword handles legacy plaintext', async () => {
  const consoleWarn = mock.method(console, 'warn', () => {});

  const result = await verifyPassword('password123', 'password123');
  assert.equal(result, true);

  assert.equal(consoleWarn.mock.callCount(), 1);
});

test('verifyPassword rejects wrong plaintext', async () => {
  const consoleWarn = mock.method(console, 'warn', () => {});

  const result = await verifyPassword('wrong', 'password123');
  assert.equal(result, false);

  assert.equal(consoleWarn.mock.callCount(), 1);
});

test('verifyPassword rejects malformed hash', async () => {
  assert.equal(await verifyPassword('p', 'scrypt:'), false);
  assert.equal(await verifyPassword('p', 'scrypt:salt'), false);
  // scrypt:salt:key:extra -> split(':') length check
  assert.equal(await verifyPassword('p', 'scrypt:salt:key:extra'), false);
});

test('verifyPassword rejects invalid hex in hash', async () => {
    const salt = randomBytes(16).toString('hex');
    const hash = `scrypt:${salt}:nothex`;
    assert.equal(await verifyPassword('password', hash), false);
});

test('safeEquals compares strings', () => {
    assert.equal(safeEquals('test', 'test'), true);
    assert.equal(safeEquals('test', 'diff'), false);
});
