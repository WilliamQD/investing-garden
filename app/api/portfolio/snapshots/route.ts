import { NextResponse } from 'next/server';

import { getAuthorizedSession } from '@/lib/auth';
import { getPortfolioSnapshots, upsertPortfolioSnapshot } from '@/lib/portfolio';

export async function GET() {
  try {
    const snapshots = await getPortfolioSnapshots();
    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('Error fetching portfolio snapshots:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthorizedSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { date, value } = body;
    const numericValue = Number(value);
    if (!date || !Number.isFinite(numericValue)) {
      return NextResponse.json(
        { error: 'Date and numeric value are required' },
        { status: 400 }
      );
    }
    const snapshot = await upsertPortfolioSnapshot(date, numericValue);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('Error saving portfolio snapshot:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}
