import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleAssistantIngest } from './assistant-ingest.ts';

const createDeps = () => {
  const actions = new Map();
  const learning = [];
  const journal = [];
  const resources = [];
  const trades = [];
  const holdings = [
    { ticker: 'RKLB', quantity: 5, purchasePrice: 76.4 },
  ];
  let settings = {
    headline: 'Investing Garden',
    summary: 'Private workspace',
    focusAreas: [],
    cashBalance: 1000,
    cashLabel: 'SPAXX',
  };

  return {
    assistantToken: 'test-assistant-token-1234567890',
    actions,
    learning,
    journal,
    resources,
    trades,
    holdings,
    getAssistantAction: async key => actions.get(key) ?? null,
    reserveAssistantAction: async action => {
      if (actions.has(action.idempotencyKey)) return { inserted: false, action: actions.get(action.idempotencyKey) };
      const stored = {
        ...action,
        status: 'pending',
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
      };
      actions.set(action.idempotencyKey, stored);
      return { inserted: true, action: stored };
    },
    completeAssistantAction: async (key, updates) => {
      const current = actions.get(key);
      const next = { ...current, ...updates, status: 'completed' };
      actions.set(key, next);
      return next;
    },
    failAssistantAction: async (key, updates) => {
      const current = actions.get(key);
      const next = { ...current, ...updates, status: 'failed' };
      actions.set(key, next);
      return next;
    },
    createEntry: async (type, entry) => {
      const created = {
        id: `${type}-${learning.length + journal.length + resources.length + 1}`,
        ...entry,
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
      };
      if (type === 'learning') learning.push(created);
      if (type === 'journal') journal.push(created);
      if (type === 'resources') resources.push(created);
      return created;
    },
    getEntries: async type => {
      if (type === 'learning') return learning;
      if (type === 'journal') return journal;
      return resources;
    },
    updateEntry: async (type, id, entry) => {
      const target = type === 'learning' ? learning : type === 'journal' ? journal : resources;
      const index = target.findIndex(item => item.id === id);
      if (index === -1) return null;
      target[index] = { ...target[index], ...entry, updatedAt: '2026-05-11T00:00:00.000Z' };
      return target[index];
    },
    getHoldings: async () => holdings,
    addPortfolioTrade: async trade => {
      const created = {
        id: `trade-${trades.length + 1}`,
        ...trade,
        createdAt: '2026-05-11T00:00:00.000Z',
      };
      trades.push(created);
      return created;
    },
    recalculateHolding: async () => ({ ok: true }),
    getSiteSettings: async () => settings,
    updateSiteSettings: async next => {
      settings = { ...settings, ...next };
      return settings;
    },
    logAuditEvent: async () => undefined,
  };
};

test('handleAssistantIngest rejects missing or invalid bearer tokens', async () => {
  const deps = createDeps();
  const request = {
    authorization: 'Bearer wrong-token',
    body: {
      idempotencyKey: 'learning-1',
      action: 'learning.create',
      payload: { title: 'ETF note', content: 'Research body' },
    },
  };

  const response = await handleAssistantIngest(request, deps);

  assert.equal(response.status, 401);
  assert.equal(deps.learning.length, 0);
});

test('handleAssistantIngest creates learning entries idempotently', async () => {
  const deps = createDeps();
  const request = {
    authorization: 'Bearer test-assistant-token-1234567890',
    body: {
      idempotencyKey: 'learning-1',
      action: 'learning.create',
      payload: { title: 'ETF note', content: 'Research body', goal: 'Track ETFs' },
    },
  };

  const first = await handleAssistantIngest(request, deps);
  const second = await handleAssistantIngest(request, deps);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(deps.learning.length, 1);
  assert.equal(first.body.result.id, second.body.result.id);
});

test('handleAssistantIngest upserts learning entries by title', async () => {
  const deps = createDeps();
  const authorization = 'Bearer test-assistant-token-1234567890';

  await handleAssistantIngest({
    authorization,
    body: {
      idempotencyKey: 'upsert-1',
      action: 'learning.upsertByTitle',
      payload: { title: 'ETF Reference List', content: 'Original' },
    },
  }, deps);
  const response = await handleAssistantIngest({
    authorization,
    body: {
      idempotencyKey: 'upsert-2',
      action: 'learning.upsertByTitle',
      payload: { title: 'ETF Reference List', content: 'Updated' },
    },
  }, deps);

  assert.equal(response.status, 200);
  assert.equal(deps.learning.length, 1);
  assert.equal(deps.learning[0].content, 'Updated');
});

test('handleAssistantIngest validates trade.create and can adjust cash', async () => {
  const deps = createDeps();
  const response = await handleAssistantIngest({
    authorization: 'Bearer test-assistant-token-1234567890',
    body: {
      idempotencyKey: 'trade-1',
      action: 'trade.create',
      payload: {
        ticker: 'SOXQ',
        action: 'buy',
        quantity: 2,
        price: 100,
        tradeDate: '2026-05-11',
        cashAdjustment: -200,
        notes: 'Executed after assistant alert',
      },
    },
  }, deps);

  assert.equal(response.status, 201);
  assert.equal(deps.trades.length, 1);
  assert.equal(deps.trades[0].ticker, 'SOXQ');
  assert.equal((await deps.getSiteSettings()).cashBalance, 800);
});

test('handleAssistantIngest rejects sells above held quantity', async () => {
  const deps = createDeps();
  const response = await handleAssistantIngest({
    authorization: 'Bearer test-assistant-token-1234567890',
    body: {
      idempotencyKey: 'trade-oversell',
      action: 'trade.create',
      payload: {
        ticker: 'RKLB',
        action: 'sell',
        quantity: 10,
        price: 120,
        tradeDate: '2026-05-11',
      },
    },
  }, deps);

  assert.equal(response.status, 400);
  assert.equal(deps.trades.length, 0);
});
