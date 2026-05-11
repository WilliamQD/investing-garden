import 'server-only';
import '@/lib/env';

import { sql } from '@vercel/postgres';

import { ensureMigrations } from '@/lib/migrations';

export type AssistantActionStatus = 'pending' | 'completed' | 'failed';

export type AssistantActionRecord = {
  idempotencyKey: string;
  action: string;
  sanitizedPayload: Record<string, unknown>;
  status: AssistantActionStatus;
  targetType?: string;
  targetId?: string;
  response?: Record<string, unknown>;
  error?: string;
  httpStatus?: number;
  createdAt: string;
  updatedAt: string;
};

const mapAssistantAction = (row: Record<string, unknown>): AssistantActionRecord => ({
  idempotencyKey: String(row.idempotency_key),
  action: String(row.action),
  sanitizedPayload: (row.sanitized_payload as Record<string, unknown>) ?? {},
  status: row.status as AssistantActionStatus,
  targetType: (row.target_type as string) || undefined,
  targetId: (row.target_id as string) || undefined,
  response: (row.response as Record<string, unknown>) || undefined,
  error: (row.error as string) || undefined,
  httpStatus: row.http_status != null ? Number(row.http_status) : undefined,
  createdAt: new Date(row.created_at as string).toISOString(),
  updatedAt: new Date(row.updated_at as string).toISOString(),
});

export async function getAssistantAction(idempotencyKey: string): Promise<AssistantActionRecord | null> {
  await ensureMigrations();
  const { rows } = await sql`
    SELECT idempotency_key, action, sanitized_payload, status, target_type, target_id,
           response, error, http_status, created_at, updated_at
    FROM assistant_actions
    WHERE idempotency_key = ${idempotencyKey}
    LIMIT 1
  `;
  return rows[0] ? mapAssistantAction(rows[0]) : null;
}

export async function reserveAssistantAction(action: {
  idempotencyKey: string;
  action: string;
  sanitizedPayload: Record<string, unknown>;
}): Promise<{ inserted: boolean; action: AssistantActionRecord }> {
  await ensureMigrations();
  const now = new Date().toISOString();
  const { rows } = await sql`
    INSERT INTO assistant_actions (
      idempotency_key, action, sanitized_payload, status, created_at, updated_at
    )
    VALUES (
      ${action.idempotencyKey}, ${action.action}, ${JSON.stringify(action.sanitizedPayload)},
      'pending', ${now}, ${now}
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING idempotency_key, action, sanitized_payload, status, target_type, target_id,
              response, error, http_status, created_at, updated_at
  `;
  if (rows[0]) {
    return { inserted: true, action: mapAssistantAction(rows[0]) };
  }
  const existing = await getAssistantAction(action.idempotencyKey);
  if (!existing) {
    throw new Error('Assistant action idempotency reservation failed.');
  }
  return { inserted: false, action: existing };
}

export async function completeAssistantAction(
  idempotencyKey: string,
  updates: {
    targetType?: string;
    targetId?: string;
    response: Record<string, unknown>;
    httpStatus: number;
  }
): Promise<AssistantActionRecord> {
  await ensureMigrations();
  const now = new Date().toISOString();
  const { rows } = await sql`
    UPDATE assistant_actions
    SET status = 'completed',
        target_type = ${updates.targetType ?? null},
        target_id = ${updates.targetId ?? null},
        response = ${JSON.stringify(updates.response)},
        error = null,
        http_status = ${updates.httpStatus},
        updated_at = ${now}
    WHERE idempotency_key = ${idempotencyKey}
    RETURNING idempotency_key, action, sanitized_payload, status, target_type, target_id,
              response, error, http_status, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error('Assistant action not found.');
  }
  return mapAssistantAction(rows[0]);
}

export async function failAssistantAction(
  idempotencyKey: string,
  updates: {
    error: string;
    response: Record<string, unknown>;
    httpStatus: number;
  }
): Promise<AssistantActionRecord> {
  await ensureMigrations();
  const now = new Date().toISOString();
  const { rows } = await sql`
    UPDATE assistant_actions
    SET status = 'failed',
        error = ${updates.error},
        response = ${JSON.stringify(updates.response)},
        http_status = ${updates.httpStatus},
        updated_at = ${now}
    WHERE idempotency_key = ${idempotencyKey}
    RETURNING idempotency_key, action, sanitized_payload, status, target_type, target_id,
              response, error, http_status, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error('Assistant action not found.');
  }
  return mapAssistantAction(rows[0]);
}
