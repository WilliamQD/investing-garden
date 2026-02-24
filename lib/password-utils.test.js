/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Mock server-only to prevent it from throwing in test environment
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  };
} catch (e) {
  // Ignore if not found
}

const { hashPassword, verifyPassword } = require('./password-utils.ts');

test('hashPassword generates valid scrypt hash', async () => {
  const hash = await hashPassword('password123');
  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
});

test('verifyPassword verifies correct hash', async () => {
  const password = 'mysecretpassword';
  const hash = await hashPassword(password);
  const isValid = await verifyPassword(password, hash);
  assert.equal(isValid, true);
});

test('verifyPassword rejects incorrect password for hash', async () => {
  const password = 'mysecretpassword';
  const hash = await hashPassword(password);
  const isValid = await verifyPassword('wrongpassword', hash);
  assert.equal(isValid, false);
});

test('verifyPassword works with legacy plaintext', async () => {
  const password = 'legacyPassword';
  // Mock console.warn to avoid cluttering output
  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = (msg) => {
    if (msg && msg.includes('SECURITY WARNING')) warnCalled = true;
  };

  try {
    const isValid = await verifyPassword(password, password);
    assert.equal(isValid, true);
    assert.equal(warnCalled, true);
  } finally {
    console.warn = originalWarn;
  }
});

test('verifyPassword rejects incorrect legacy plaintext', async () => {
  // Mock console.warn
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const isValid = await verifyPassword('wrong', 'right');
    assert.equal(isValid, false);
  } finally {
    console.warn = originalWarn;
  }
});
