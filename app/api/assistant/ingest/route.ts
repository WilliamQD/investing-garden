import { NextResponse } from 'next/server';

import { handleAssistantIngest } from '@/lib/assistant-ingest';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit('assistant:ingest', {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many assistant updates. Try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const result = await handleAssistantIngest({
    authorization: request.headers.get('authorization'),
    body,
  });
  return NextResponse.json(result.body, { status: result.status });
}
