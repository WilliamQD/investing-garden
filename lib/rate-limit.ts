import 'server-only';

import { getRequestIp } from '@/lib/auth';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number | null;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 2000;

const pruneBuckets = (now: number) => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
  if (buckets.size <= MAX_BUCKETS) return;
  const entries = Array.from(buckets.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt);
  const toRemove = entries.slice(0, buckets.size - MAX_BUCKETS);
  for (const [key] of toRemove) {
    buckets.delete(key);
  }
};

export const checkRateLimit = async (
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> => {
  const now = Date.now();
  pruneBuckets(now);
  const ip = await getRequestIp();
  const bucketKey = `${key}:${ip}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
      retryAfter: null,
    };
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter,
    };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return {
    allowed: true,
    remaining: Math.max(options.limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfter: null,
  };
};
