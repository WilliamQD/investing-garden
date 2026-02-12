import 'server-only';

export type QuoteTimestampInput = {
  timestamp?: string | number;
  datetime?: string;
};

export const parseNumeric = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const resolveQuoteUpdatedAt = (data: QuoteTimestampInput): string => {
  if (typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)) {
    return new Date(data.timestamp * 1000).toISOString();
  }
  if (typeof data.timestamp === 'string' && /^\d+(\.\d+)?$/.test(data.timestamp)) {
    return new Date(Number.parseFloat(data.timestamp) * 1000).toISOString();
  }
  if (typeof data.datetime === 'string') {
    const parsed = new Date(data.datetime.replace(' ', 'T'));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
};
