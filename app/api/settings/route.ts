import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { getSiteSettings, updateSiteSettings } from '@/lib/portfolio';

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
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const settings = await updateSiteSettings(body ?? {});
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating site settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
