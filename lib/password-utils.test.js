import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password-utils.ts';

describe('password-utils', () => {
  describe('hashPassword', () => {
    it('should return a string in scrypt format', () => {
      const password = 'testpassword';
      const hash = hashPassword(password);

      assert.ok(hash.startsWith('scrypt:'));
      const parts = hash.split(':');
      assert.equal(parts.length, 3);
      // check lengths of salt and derivedKey (hex encoded)
      assert.equal(parts[1].length, 32); // 16 bytes * 2 hex chars
      assert.equal(parts[2].length, 128); // 64 bytes * 2 hex chars
    });

    it('should generate different salts for same password', () => {
      const password = 'testpassword';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      assert.notEqual(hash1, hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a valid scrypt hash', () => {
      const password = 'mysecretpassword';
      const hash = hashPassword(password);

      assert.equal(verifyPassword(password, hash), true);
    });

    it('should reject an incorrect password with scrypt hash', () => {
      const password = 'mysecretpassword';
      const hash = hashPassword(password);

      assert.equal(verifyPassword('wrongpassword', hash), false);
    });

    it('should verify legacy plaintext password', () => {
      const password = 'mypassword';
      // stored as plaintext
      assert.equal(verifyPassword(password, password), true);
    });

    it('should reject incorrect legacy plaintext password', () => {
      assert.equal(verifyPassword('wrong', 'right'), false);
    });

    it('should return false for malformed hash', () => {
      assert.equal(verifyPassword('password', 'scrypt:invalid'), false);
      assert.equal(verifyPassword('password', 'scrypt:invalid:format'), false);
    });

    it('should return false for empty stored password', () => {
      assert.equal(verifyPassword('password', ''), false);
    });
  });
});
