import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveOwnerSession } from './route-auth.ts';

test('resolveOwnerSession rejects anonymous personal-data reads', async () => {
  const result = await resolveOwnerSession(async () => null);

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Unauthorized',
  });
});

test('resolveOwnerSession allows authenticated owner sessions', async () => {
  const session = {
    isAuthenticated: true,
    username: 'owner',
    canWrite: true,
    source: 'cookie',
  };

  const result = await resolveOwnerSession(async () => session);

  assert.deepEqual(result, {
    ok: true,
    session,
  });
});
