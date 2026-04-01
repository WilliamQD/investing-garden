import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const hashPassword = async (password) => {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

const main = async () => {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: node scripts/hash-password.mjs <password>');
    process.exit(1);
  }

  try {
    const hash = await hashPassword(password);
    console.log(hash);
  } catch (error) {
    console.error('Error generating hash:', error);
    process.exit(1);
  }
};

main();
