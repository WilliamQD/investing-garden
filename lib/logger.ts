import 'server-only';

export const logInfo = (event: string, details: Record<string, unknown> = {}) => {
  console.info(JSON.stringify({ level: 'info', event, ...details, timestamp: new Date().toISOString() }));
};

export const logError = (event: string, error: unknown, details: Record<string, unknown> = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ level: 'error', event, message, ...details, timestamp: new Date().toISOString() })
  );
};
