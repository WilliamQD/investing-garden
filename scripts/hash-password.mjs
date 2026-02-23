import { scryptSync, randomBytes } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const derivedKey = scryptSync(password, salt, 64).toString('hex');
const hash = `scrypt:${salt}:${derivedKey}`;

console.log(`\nPassword: ${password}`);
console.log(`Hash:     ${hash}\n`);
console.log('Update your .env.local file with this hash in ADMIN_CREDENTIALS or ADMIN_TOKEN.');
console.log('Example ADMIN_CREDENTIALS:');
console.log(`[{"username":"admin","password":"${hash}","role":"admin"}]`);
