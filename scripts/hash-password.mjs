import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

// Promisify scrypt for async usage
const scryptAsync = promisify(scrypt);

const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64));
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

hashPassword(password)
  .then(hash => console.log(hash))
  .catch(err => {
    console.error('Error hashing password:', err);
    process.exit(1);
  });
