import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSiteSettings, updateSiteSettings } from '@/lib/portfolio';
import { normalizeSettingsInput } from '@/lib/validation';

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const rateLimit = await checkRateLimit('settings:update', { limit: 15, windowMs: 60_000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many settings updates. Try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    if (!body || Array.isArray(body) || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
    }
    const normalized = normalizeSettingsInput(body as Record<string, unknown>);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.error ?? 'Invalid settings payload' }, { status: 400 });
    }
    const settings = await updateSiteSettings(normalized.data);
    await logAuditEvent('site_settings_updated', session);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating site settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
