import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import {
  completeAssistantAction,
  failAssistantAction,
  getAssistantAction,
  reserveAssistantAction,
  type AssistantActionRecord,
} from '@/lib/assistant-actions';
import { logAuditEvent } from '@/lib/audit';
import {
  addPortfolioTrade,
  getHoldings,
  getSiteSettings,
  recalculateHolding,
  updateSiteSettings,
  type Holding,
} from '@/lib/portfolio';
import { storage, type Entry, type EntryType } from '@/lib/storage';
import { normalizeEntryInput, normalizeIsoDate, normalizeTicker } from '@/lib/validation';

type AssistantAction =
  | 'trade.create'
  | 'learning.create'
  | 'learning.upsertByTitle'
  | 'resource.create'
  | 'journal.create'
  | 'settings.cash.adjust';

type AssistantDeps = {
  assistantToken?: string;
  getAssistantAction: (idempotencyKey: string) => Promise<AssistantActionRecord | null>;
  reserveAssistantAction: (action: {
    idempotencyKey: string;
    action: string;
    sanitizedPayload: Record<string, unknown>;
  }) => Promise<{ inserted: boolean; action: AssistantActionRecord }>;
  completeAssistantAction: (
    idempotencyKey: string,
    updates: {
      targetType?: string;
      targetId?: string;
      response: Record<string, unknown>;
      httpStatus: number;
    }
  ) => Promise<AssistantActionRecord>;
  failAssistantAction: (
    idempotencyKey: string,
    updates: { error: string; response: Record<string, unknown>; httpStatus: number }
  ) => Promise<AssistantActionRecord>;
  createEntry: (type: EntryType, entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Entry>;
  getEntries: (type: EntryType) => Promise<Entry[]>;
  updateEntry: (
    type: EntryType,
    id: string,
    entry: Partial<Omit<Entry, 'id' | 'createdAt'>>
  ) => Promise<Entry | null>;
  getHoldings: () => Promise<Holding[]>;
  addPortfolioTrade: typeof addPortfolioTrade;
  recalculateHolding: typeof recalculateHolding;
  getSiteSettings: typeof getSiteSettings;
  updateSiteSettings: typeof updateSiteSettings;
  logAuditEvent: typeof logAuditEvent;
};

type AssistantIngestRequest = {
  authorization: string | null;
  body: unknown;
};

type AssistantIngestResponse = {
  status: number;
  body: Record<string, unknown>;
};

type ActionResult = {
  status: number;
  body: Record<string, unknown>;
  targetType?: string;
  targetId?: string;
};

const VALID_ACTIONS = new Set<AssistantAction>([
  'trade.create',
  'learning.create',
  'learning.upsertByTitle',
  'resource.create',
  'journal.create',
  'settings.cash.adjust',
]);

class AssistantInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const defaultDeps: AssistantDeps = {
  assistantToken: process.env.ASSISTANT_INGEST_TOKEN ?? process.env.IG_ASSISTANT_INGEST_TOKEN,
  getAssistantAction,
  reserveAssistantAction,
  completeAssistantAction,
  failAssistantAction,
  createEntry: (type, entry) => storage.create(type, entry),
  getEntries: type => storage.getAll(type),
  updateEntry: (type, id, entry) => storage.update(type, id, entry),
  getHoldings,
  addPortfolioTrade,
  recalculateHolding,
  getSiteSettings,
  updateSiteSettings,
  logAuditEvent,
};

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const getBearerToken = (authorization: string | null) => {
  const [scheme, token] = (authorization ?? '').split(/\s+/, 2);
  if (scheme !== 'Bearer' || !token) return '';
  return token.trim();
};

const isAuthorized = (authorization: string | null, assistantToken?: string) => {
  if (!assistantToken || assistantToken.length < 16) return false;
  const provided = getBearerToken(authorization);
  if (!provided) return false;
  return safeEquals(provided, assistantToken);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseRequestBody = (body: unknown) => {
  if (!isRecord(body)) {
    throw new AssistantInputError('Invalid request payload.');
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (!idempotencyKey || idempotencyKey.length > 160) {
    throw new AssistantInputError('A valid idempotencyKey is required.');
  }
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!VALID_ACTIONS.has(action as AssistantAction)) {
    throw new AssistantInputError('Unsupported assistant action.');
  }
  if (!isRecord(body.payload)) {
    throw new AssistantInputError('Payload must be an object.');
  }
  return {
    idempotencyKey,
    action: action as AssistantAction,
    payload: body.payload,
  };
};

const normalizeEntryPayload = (type: EntryType, payload: Record<string, unknown>) => {
  const normalized = normalizeEntryInput(type, payload);
  if (!normalized.data) {
    throw new AssistantInputError(normalized.error ?? 'Invalid entry payload.');
  }
  return normalized.data;
};

const createEntryResult = async (
  deps: AssistantDeps,
  type: EntryType,
  payload: Record<string, unknown>,
  targetType: string
): Promise<ActionResult> => {
  const data = normalizeEntryPayload(type, payload);
  const entry = await deps.createEntry(type, data);
  return {
    status: 201,
    targetType,
    targetId: entry.id,
    body: { success: true, result: entry },
  };
};

const upsertLearningByTitle = async (
  deps: AssistantDeps,
  payload: Record<string, unknown>
): Promise<ActionResult> => {
  const data = normalizeEntryPayload('learning', payload);
  const existing = (await deps.getEntries('learning')).find(
    entry => entry.title.trim().toLowerCase() === data.title.trim().toLowerCase()
  );
  if (!existing) {
    const entry = await deps.createEntry('learning', data);
    return {
      status: 201,
      targetType: 'learning',
      targetId: entry.id,
      body: { success: true, result: entry },
    };
  }
  const entry = await deps.updateEntry('learning', existing.id, data);
  if (!entry) {
    throw new AssistantInputError('Learning entry disappeared during upsert.', 409);
  }
  return {
    status: 200,
    targetType: 'learning',
    targetId: entry.id,
    body: { success: true, result: entry },
  };
};

const parseTradePayload = (payload: Record<string, unknown>) => {
  const ticker = normalizeTicker(payload.ticker);
  if (!ticker) {
    throw new AssistantInputError('Ticker must be 1-10 characters (letters, numbers, . or -).');
  }
  const rawAction = String(payload.action ?? '').toLowerCase();
  if (rawAction !== 'buy' && rawAction !== 'sell') {
    throw new AssistantInputError('Action must be "buy" or "sell".');
  }
  const action: 'buy' | 'sell' = rawAction === 'buy' ? 'buy' : 'sell';
  const quantity = Number(payload.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AssistantInputError('Quantity must be a positive number.');
  }
  const price = Number(payload.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new AssistantInputError('Price must be a non-negative number.');
  }
  const tradeDate = normalizeIsoDate(payload.tradeDate);
  if (!tradeDate) {
    throw new AssistantInputError('Trade date must be YYYY-MM-DD.');
  }
  let gainLoss: number | null = null;
  if (payload.gainLoss != null && payload.gainLoss !== '') {
    const parsed = Number(payload.gainLoss);
    if (!Number.isFinite(parsed)) {
      throw new AssistantInputError('Gain/loss must be a number.');
    }
    gainLoss = parsed;
  }
  let cashAdjustment: number | null = null;
  if (payload.cashAdjustment != null && payload.cashAdjustment !== '') {
    const parsed = Number(payload.cashAdjustment);
    if (!Number.isFinite(parsed)) {
      throw new AssistantInputError('Cash adjustment must be a number.');
    }
    cashAdjustment = parsed;
  }
  const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 500) || null : null;
  return { ticker, action, quantity, price, tradeDate, gainLoss, notes, cashAdjustment };
};

const createTrade = async (
  deps: AssistantDeps,
  payload: Record<string, unknown>
): Promise<ActionResult> => {
  const tradeInput = parseTradePayload(payload);
  let gainLoss = tradeInput.gainLoss;
  if (tradeInput.action === 'sell') {
    const holding = (await deps.getHoldings()).find(item => item.ticker === tradeInput.ticker);
    const heldQty = holding?.quantity ?? 0;
    if (heldQty < tradeInput.quantity) {
      throw new AssistantInputError(`Cannot sell ${tradeInput.quantity} shares - only ${heldQty} held.`);
    }
    if (gainLoss == null) {
      const avgCost = holding?.purchasePrice ?? 0;
      gainLoss = (tradeInput.price - avgCost) * tradeInput.quantity;
    }
  }
  const trade = await deps.addPortfolioTrade({
    ticker: tradeInput.ticker,
    action: tradeInput.action,
    quantity: tradeInput.quantity,
    price: tradeInput.price,
    tradeDate: tradeInput.tradeDate,
    gainLoss,
    notes: tradeInput.notes,
  });
  await deps.recalculateHolding(tradeInput.ticker);
  if (tradeInput.cashAdjustment != null) {
    const settings = await deps.getSiteSettings();
    const nextCashBalance = (settings.cashBalance ?? 0) + tradeInput.cashAdjustment;
    if (nextCashBalance < 0) {
      throw new AssistantInputError('Cash adjustment would make cash balance negative.');
    }
    await deps.updateSiteSettings({ ...settings, cashBalance: nextCashBalance });
  }
  return {
    status: 201,
    targetType: 'trade',
    targetId: trade.id,
    body: { success: true, result: trade },
  };
};

const adjustCash = async (
  deps: AssistantDeps,
  payload: Record<string, unknown>
): Promise<ActionResult> => {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount)) {
    throw new AssistantInputError('Amount must be a number.');
  }
  const settings = await deps.getSiteSettings();
  const nextCashBalance = (settings.cashBalance ?? 0) + amount;
  if (nextCashBalance < 0) {
    throw new AssistantInputError('Cash adjustment would make cash balance negative.');
  }
  const updated = await deps.updateSiteSettings({ ...settings, cashBalance: nextCashBalance });
  return {
    status: 200,
    targetType: 'settings',
    targetId: 'cashBalance',
    body: { success: true, result: updated },
  };
};

const executeAction = async (
  deps: AssistantDeps,
  action: AssistantAction,
  payload: Record<string, unknown>
): Promise<ActionResult> => {
  if (action === 'learning.create') {
    return createEntryResult(deps, 'learning', payload, 'learning');
  }
  if (action === 'learning.upsertByTitle') {
    return upsertLearningByTitle(deps, payload);
  }
  if (action === 'resource.create') {
    return createEntryResult(deps, 'resources', payload, 'resource');
  }
  if (action === 'journal.create') {
    return createEntryResult(deps, 'journal', payload, 'journal');
  }
  if (action === 'trade.create') {
    return createTrade(deps, payload);
  }
  return adjustCash(deps, payload);
};

const responseForExistingAction = (action: AssistantActionRecord): AssistantIngestResponse => {
  if (action.status === 'completed') {
    return {
      status: action.httpStatus ?? 200,
      body: action.response ?? { success: true },
    };
  }
  if (action.status === 'failed') {
    return {
      status: action.httpStatus ?? 400,
      body: action.response ?? { error: action.error ?? 'Assistant action failed.' },
    };
  }
  return {
    status: 409,
    body: { error: 'Assistant action is already in progress.' },
  };
};

export async function handleAssistantIngest(
  request: AssistantIngestRequest,
  deps: AssistantDeps = defaultDeps
): Promise<AssistantIngestResponse> {
  if (!isAuthorized(request.authorization, deps.assistantToken)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  let parsed: ReturnType<typeof parseRequestBody>;
  try {
    parsed = parseRequestBody(request.body);
  } catch (error) {
    return {
      status: error instanceof AssistantInputError ? error.status : 400,
      body: { error: error instanceof Error ? error.message : 'Invalid request payload.' },
    };
  }

  const reservation = await deps.reserveAssistantAction({
    idempotencyKey: parsed.idempotencyKey,
    action: parsed.action,
    sanitizedPayload: parsed.payload,
  });
  if (!reservation.inserted) {
    return responseForExistingAction(reservation.action);
  }

  try {
    const result = await executeAction(deps, parsed.action, parsed.payload);
    await deps.completeAssistantAction(parsed.idempotencyKey, {
      targetType: result.targetType,
      targetId: result.targetId,
      response: result.body,
      httpStatus: result.status,
    });
    await deps.logAuditEvent('assistant_action_completed', {
      username: 'codex-assistant',
      source: 'assistant',
    }, {
      action: parsed.action,
      idempotencyKey: parsed.idempotencyKey,
      targetType: result.targetType ?? null,
      targetId: result.targetId ?? null,
    });
    return result;
  } catch (error) {
    const status = error instanceof AssistantInputError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Assistant action failed.';
    const response = { error: message };
    await deps.failAssistantAction(parsed.idempotencyKey, {
      error: message,
      response,
      httpStatus: status,
    });
    await deps.logAuditEvent('assistant_action_failed', {
      username: 'codex-assistant',
      source: 'assistant',
    }, {
      action: parsed.action,
      idempotencyKey: parsed.idempotencyKey,
      status,
    });
    return { status, body: response };
  }
}
