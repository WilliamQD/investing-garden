import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const MIN_PASSWORD_LENGTH = 8;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

async function hashPassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

hashPassword(password)
  .then((hash) => console.log(hash))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
