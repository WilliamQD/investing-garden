import 'server-only';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * Hash a password using scrypt.
 * Format: scrypt:<salt>:<derivedKey>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a stored hash or plaintext credential.
 * Supports legacy plaintext passwords with a warning.
 */
export async function verifyPassword(password: string, storedCredential: string): Promise<boolean> {
  if (!password || !storedCredential) return false;

  if (storedCredential.startsWith('scrypt:')) {
    const parts = storedCredential.split(':');
    if (parts.length !== 3) return false;
    const [_, salt, key] = parts;

    try {
      const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
      const storedKeyBuffer = Buffer.from(key, 'hex');
      return timingSafeEqual(derivedKey, storedKeyBuffer);
    } catch {
      return false;
    }
  }

  // Legacy plaintext fallback
  console.warn('SECURITY WARNING: Using plaintext password comparison. Please migrate to scrypt hashes.');

  const passwordBuffer = Buffer.from(password);
  const storedBuffer = Buffer.from(storedCredential);

  if (passwordBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(passwordBuffer, storedBuffer);
}
