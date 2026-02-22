import 'server-only';

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash.startsWith('scrypt:')) {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;

  const [_, salt, key] = parts;
  const derivedKeyBuffer = Buffer.from(key, 'hex');

  try {
    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(derivedKey, derivedKeyBuffer);
  } catch {
    return false;
  }
};
