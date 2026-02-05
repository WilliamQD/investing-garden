import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch');
    }
    const data = await response.json();
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote || quote.regularMarketPrice == null) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    return NextResponse.json({
      ticker,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      changePercent: quote.regularMarketChangePercent,
      updatedAt: quote.regularMarketTime
        ? new Date(quote.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
