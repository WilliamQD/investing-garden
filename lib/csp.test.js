import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('CSP headers are configured correctly', async () => {
  // Dynamically import the ESM config file
  const configPath = path.resolve(__dirname, '../next.config.mjs');
  const configModule = await import(configPath);
  const config = configModule.default;

  // Check if headers function exists
  assert.strictEqual(typeof config.headers, 'function', 'headers function is missing in next.config.mjs');

  // get headers
  const headers = await config.headers();

  // Find the CSP header
  const cspEntry = headers.find(h => h.source === '/(.*)');
  assert.ok(cspEntry, 'Global headers for /(.*) are missing');

  const cspHeader = cspEntry.headers.find(h => h.key === 'Content-Security-Policy' || h.key === 'content-security-policy');
  assert.ok(cspHeader, 'Content-Security-Policy header is missing');

  const policy = cspHeader.value;

  // Verify specific directives
  assert.ok(policy.includes("default-src 'self'"), "Missing default-src 'self'");
  assert.ok(policy.includes("script-src 'self'"), "Missing script-src 'self'");
  assert.ok(policy.includes("style-src 'self'"), "Missing style-src 'self'");
  assert.ok(policy.includes("img-src 'self'"), "Missing img-src 'self'");
  assert.ok(policy.includes("font-src 'self'"), "Missing font-src 'self'");
  assert.ok(policy.includes("object-src 'none'"), "Missing object-src 'none'");
  assert.ok(policy.includes("base-uri 'self'"), "Missing base-uri 'self'");
  assert.ok(policy.includes("form-action 'self'"), "Missing form-action 'self'");
  assert.ok(policy.includes("frame-ancestors 'none'"), "Missing frame-ancestors 'none'");
  assert.ok(policy.includes("upgrade-insecure-requests"), "Missing upgrade-insecure-requests");
});
