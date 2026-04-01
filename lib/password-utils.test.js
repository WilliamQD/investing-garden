/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { hashPassword, verifyPassword } = require('./password-utils.ts');

test('hashPassword generates a valid scrypt hash', async () => {
  const password = 'mysecretpassword';
  const hash = await hashPassword(password);

  // scrypt:salt(16 bytes hex = 32 chars):key(64 bytes hex = 128 chars)
  assert.match(hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
});

test('verifyPassword returns true for correct password', async () => {
  const password = 'mysecretpassword';
  const hash = await hashPassword(password);

  const isValid = await verifyPassword(password, hash);
  assert.equal(isValid, true);
});

test('verifyPassword returns false for incorrect password', async () => {
  const password = 'mysecretpassword';
  const hash = await hashPassword(password);

  const isValid = await verifyPassword('wrongpassword', hash);
  assert.equal(isValid, false);
});

test('verifyPassword returns false for non-scrypt hash', async () => {
  const isValid = await verifyPassword('password', 'plaintexthash');
  assert.equal(isValid, false);
});

test('verifyPassword returns false for malformed hash', async () => {
  const isValid = await verifyPassword('password', 'scrypt:malformed');
  assert.equal(isValid, false);
});
