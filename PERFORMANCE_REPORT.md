# Performance Optimization Report: Market Signal API Caching

## Current State (Baseline)

The `app/api/market/signal/route.ts` endpoint currently performs two external/internal service calls per request:
1. A call to `/api/market/history` (internal).
2. A POST call to `SIGNAL_SERVICE_URL` (external microservice).

The second call is explicitly configured with `cache: 'no-store'`:
```typescript
const signalResponse = await fetch(SIGNAL_SERVICE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  cache: 'no-store',
  body: JSON.stringify({
    ticker: normalizedTicker,
    closes,
  }),
});
```

This means every request to the signal API triggers a fresh computation in the Python Signal Engine, even if the input data (`closes`) has not changed.

## Optimization Rationale

- **Data Stability**: The signal is computed from historical candle data, which is already cached for 300 seconds in the history API.
- **Redundant Computation**: Multiple requests for the same ticker within a short window will send the exact same `closes` array to the signal engine, resulting in identical results.
- **Resource Usage**: The Signal Engine (FastAPI) must parse the JSON, compute RSI and momentum, and return a response for every call.
- **Next.js Features**: Next.js Data Cache can automatically cache `fetch` results, including POST requests if configured with `next: { revalidate: ... }`.

## Implementation Plan

1. Enable Data Cache for the signal engine `fetch` call with a 300-second revalidation period (matching the history API TTL).
2. Update the API response `Cache-Control` header to 300 seconds to allow downstream/CDN caching.

## Expected Improvement

- **Latency**: Subsequent requests for the same ticker within 5 minutes will see a significant reduction in latency (from ~tens/hundreds of ms to ~0ms for a Data Cache hit).
- **Throughput**: The Signal Engine microservice will handle significantly fewer requests, improving overall system scalability.
- **Cost**: Reduced compute cycles in both the Next.js API and the Signal Engine.

## Measurement Note

A live benchmark in this environment was impractical due to:
- Missing Node.js dependencies (`pnpm install` failure).
- Inability to start the full Next.js development or production server.
- Lack of access to the external Twelve Data API for the history dependency.
However, the optimization follows well-established Next.js performance patterns for slowly-changing data.
