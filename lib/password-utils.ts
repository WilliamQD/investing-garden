import 'server-only';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hashes a password using scrypt.
 * format: scrypt:salt:derivedKey
 */
export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
};

/**
 * Verifies a password against a stored credential.
 * Supports both scrypt hashes (scrypt:salt:key) and legacy plaintext.
 */
export const verifyPassword = (password: string, stored: string): boolean => {
  if (!stored) return false;

  // Handle legacy plaintext (BACKWARD COMPATIBILITY)
  if (!stored.startsWith('scrypt:')) {
    // Basic constant-time comparison for plaintext
    const a = Buffer.from(password);
    const b = Buffer.from(stored);

    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [_, salt, key] = parts;

  try {
    const derivedKeyBuffer = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return timingSafeEqual(derivedKeyBuffer, keyBuffer);
  } catch {
    return false;
  }
};
