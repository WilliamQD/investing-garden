import 'server-only';

import { getRequestIp } from '@/lib/auth';
import { logError, logInfo } from '@/lib/logger';

type AuditSession = {
  username: string;
  role: string;
  source?: string;
};

export const logAuditEvent = async (
  event: string,
  session: AuditSession | null,
  details: Record<string, unknown> = {}
) => {
  const ip = await getRequestIp();
  logInfo('audit_event', {
    event,
    actor: session?.username ?? 'unknown',
    role: session?.role ?? 'unknown',
    source: session?.source ?? 'unknown',
    ip,
    ...details,
  });
};

export const logAuditFailure = async (
  event: string,
  error: unknown,
  session: AuditSession | null,
  details: Record<string, unknown> = {}
) => {
  const ip = await getRequestIp();
  logError('audit_event_failed', error, {
    event,
    actor: session?.username ?? 'unknown',
    role: session?.role ?? 'unknown',
    source: session?.source ?? 'unknown',
    ip,
    ...details,
  });
};
