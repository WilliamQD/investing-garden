import 'server-only';

import { sql } from '@vercel/postgres';
import { randomUUID } from 'crypto';

import { ensureMigrations } from '@/lib/migrations';

export interface PortfolioSnapshot {
  date: string;
  value: number;
  updatedAt: string;
}

export interface Holding {
  id: string;
  ticker: string;
  label?: string;
  quantity?: number;
  purchasePrice?: number;
  createdAt: string;
}

export interface SiteSettings {
  headline: string;
  summary: string;
  focusAreas: string[];
  cashBalance?: number;
  cashLabel?: string;
}

export interface PortfolioTrade {
  id: string;
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  tradeDate: string;
  gainLoss?: number;
  notes?: string;
  createdAt: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  headline: 'Investing Garden',
  summary:
    'A clean, industrial workspace for tracking portfolio moves, market context, and research notes in one place.',
  focusAreas: [],
  cashBalance: 0,
  cashLabel: 'SPAXX',
};

const normalizeSettings = (data: Partial<SiteSettings> | null): SiteSettings => {
  const headline =
    typeof data?.headline === 'string' && data.headline.trim()
      ? data.headline.trim()
      : DEFAULT_SETTINGS.headline;
  const summary =
    typeof data?.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : DEFAULT_SETTINGS.summary;
  const focusAreas = Array.isArray(data?.focusAreas)
    ? data.focusAreas.map(area => area.trim()).filter(Boolean)
    : DEFAULT_SETTINGS.focusAreas;
  const rawCash = Number(data?.cashBalance);
  const cashBalance = Number.isFinite(rawCash) && rawCash >= 0 ? rawCash : DEFAULT_SETTINGS.cashBalance;
  const cashLabel =
    typeof data?.cashLabel === 'string' && data.cashLabel.trim()
      ? data.cashLabel.trim().slice(0, 20)
      : DEFAULT_SETTINGS.cashLabel;
  return {
    headline,
    summary,
    focusAreas,
    cashBalance,
    cashLabel,
  };
};

async function ensureTables() {
  await ensureMigrations();
}

const mapSnapshot = (row: Record<string, unknown>): PortfolioSnapshot => ({
  date: String(row.snapshot_date),
  value: Number(row.value),
  updatedAt: new Date(row.updated_at as string).toISOString(),
});

const mapHolding = (row: Record<string, unknown>): Holding => ({
  id: row.id as string,
  ticker: row.ticker as string,
  label: (row.label as string) || undefined,
  quantity: row.quantity != null ? Number(row.quantity) : undefined,
  purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : undefined,
  createdAt: new Date(row.created_at as string).toISOString(),
});

export async function getPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  await ensureTables();
  const { rows } = await sql`
    SELECT snapshot_date, value, updated_at
    FROM portfolio_snapshots
    ORDER BY snapshot_date ASC
  `;
  return rows.map(row => mapSnapshot(row));
}

export async function upsertPortfolioSnapshot(
  date: string,
  value: number
): Promise<PortfolioSnapshot> {
  await ensureTables();
  const updatedAt = new Date().toISOString();
  const { rows } = await sql`
    INSERT INTO portfolio_snapshots (snapshot_date, value, updated_at)
    VALUES (${date}, ${value}, ${updatedAt})
    ON CONFLICT (snapshot_date)
    DO UPDATE SET value = ${value}, updated_at = ${updatedAt}
    RETURNING snapshot_date, value, updated_at
  `;
  return mapSnapshot(rows[0]);
}

export async function getHoldings(): Promise<Holding[]> {
  await ensureTables();
  const { rows } = await sql`
    SELECT id, ticker, label, quantity, purchase_price, created_at
    FROM portfolio_holdings
    ORDER BY created_at DESC
  `;
  return rows.map(row => mapHolding(row));
}

export async function addHolding(
  ticker: string,
  label?: string,
  quantity?: number | null,
  purchasePrice?: number | null
): Promise<Holding> {
  await ensureTables();
  const normalizedTicker = ticker.trim().toUpperCase();
  const { rows: existing } = await sql`
    SELECT id, ticker, label, quantity, purchase_price, created_at
    FROM portfolio_holdings
    WHERE ticker = ${normalizedTicker}
    LIMIT 1
  `;
  if (existing[0]) {
    return mapHolding(existing[0]);
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const { rows } = await sql`
    INSERT INTO portfolio_holdings (id, ticker, label, quantity, purchase_price, created_at)
    VALUES (${id}, ${normalizedTicker}, ${label ?? null}, ${quantity ?? null}, ${purchasePrice ?? null}, ${createdAt})
    ON CONFLICT (ticker)
    DO UPDATE SET
      label = COALESCE(EXCLUDED.label, portfolio_holdings.label),
      quantity = COALESCE(EXCLUDED.quantity, portfolio_holdings.quantity),
      purchase_price = COALESCE(EXCLUDED.purchase_price, portfolio_holdings.purchase_price)
    RETURNING id, ticker, label, quantity, purchase_price, created_at
  `;
  return mapHolding(rows[0]);
}

export async function deleteHolding(id: string): Promise<boolean> {
  await ensureTables();
  const result = await sql`
    DELETE FROM portfolio_holdings WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function updateHolding(
  id: string,
  {
    label,
    quantity,
    purchasePrice,
  }: { label: string | null; quantity: number | null; purchasePrice: number | null }
): Promise<Holding | null> {
  await ensureTables();
  const { rows } = await sql`
    UPDATE portfolio_holdings
    SET label = ${label}, quantity = ${quantity}, purchase_price = ${purchasePrice}
    WHERE id = ${id}
    RETURNING id, ticker, label, quantity, purchase_price, created_at
  `;
  if (!rows[0]) {
    return null;
  }
  return mapHolding(rows[0]);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  await ensureTables();
  const { rows } = await sql`
    SELECT data FROM site_settings WHERE id = 'profile'
  `;
  if (!rows[0]) {
    return DEFAULT_SETTINGS;
  }
  return normalizeSettings(rows[0].data as Partial<SiteSettings>);
}

const mapTrade = (row: Record<string, unknown>): PortfolioTrade => ({
  id: row.id as string,
  ticker: row.ticker as string,
  action: row.action as 'buy' | 'sell',
  quantity: Number(row.quantity),
  price: Number(row.price),
  tradeDate: row.trade_date instanceof Date
    ? row.trade_date.toISOString().slice(0, 10)
    : String(row.trade_date).slice(0, 10),
  gainLoss: row.gain_loss != null ? Number(row.gain_loss) : undefined,
  notes: (row.notes as string) || undefined,
  createdAt: new Date(row.created_at as string).toISOString(),
});

export async function getPortfolioTrades(): Promise<PortfolioTrade[]> {
  await ensureTables();
  const { rows } = await sql`
    SELECT id, ticker, action, quantity, price, trade_date, gain_loss, notes, created_at
    FROM portfolio_trades
    ORDER BY trade_date DESC
  `;
  return rows.map(row => mapTrade(row));
}

export async function addPortfolioTrade(trade: {
  ticker: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  tradeDate: string;
  gainLoss?: number | null;
  notes?: string | null;
}): Promise<PortfolioTrade> {
  await ensureTables();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const { rows } = await sql`
    INSERT INTO portfolio_trades (id, ticker, action, quantity, price, trade_date, gain_loss, notes, created_at)
    VALUES (${id}, ${trade.ticker.trim().toUpperCase()}, ${trade.action}, ${trade.quantity}, ${trade.price}, ${trade.tradeDate}, ${trade.gainLoss ?? null}, ${trade.notes ?? null}, ${createdAt})
    RETURNING id, ticker, action, quantity, price, trade_date, gain_loss, notes, created_at
  `;
  return mapTrade(rows[0]);
}

export async function updatePortfolioTrade(
  id: string,
  updates: {
    ticker?: string;
    action?: 'buy' | 'sell';
    quantity?: number;
    price?: number;
    tradeDate?: string;
    gainLoss?: number | null;
    notes?: string | null;
  }
): Promise<PortfolioTrade | null> {
  await ensureTables();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.ticker != null) { fields.push('ticker'); values.push(updates.ticker.trim().toUpperCase()); }
  if (updates.action != null) { fields.push('action'); values.push(updates.action); }
  if (updates.quantity != null) { fields.push('quantity'); values.push(updates.quantity); }
  if (updates.price != null) { fields.push('price'); values.push(updates.price); }
  if (updates.tradeDate != null) { fields.push('trade_date'); values.push(updates.tradeDate); }
  if ('gainLoss' in updates) { fields.push('gain_loss'); values.push(updates.gainLoss ?? null); }
  if ('notes' in updates) { fields.push('notes'); values.push(updates.notes ?? null); }
  if (fields.length === 0) return null;
  // Build the SET clause dynamically
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const query = `UPDATE portfolio_trades SET ${setClauses} WHERE id = $1 RETURNING id, ticker, action, quantity, price, trade_date, gain_loss, notes, created_at`;
  const { rows } = await sql.query(query, [id, ...values]);
  return rows[0] ? mapTrade(rows[0]) : null;
}

export async function deletePortfolioTrade(id: string): Promise<boolean> {
  await ensureTables();
  const result = await sql`
    DELETE FROM portfolio_trades WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

/**
 * Recalculate a holding's quantity and average cost from its full trade history.
 * Uses the average cost basis method (Fidelity default):
 * - BUY: add shares and cost to pool
 * - SELL: remove shares, reduce cost proportionally at current avg cost
 * If final qty <= 0, the holding is deleted. Otherwise it's upserted.
 */
export async function recalculateHolding(ticker: string): Promise<Holding | null> {
  await ensureTables();
  const normalizedTicker = ticker.trim().toUpperCase();

  const { rows: tradeRows } = await sql`
    SELECT action, quantity, price
    FROM portfolio_trades
    WHERE ticker = ${normalizedTicker}
    ORDER BY trade_date ASC, created_at ASC
  `;

  let totalShares = 0;
  let totalCost = 0;

  for (const row of tradeRows) {
    const qty = Number(row.quantity);
    const price = Number(row.price);
    if (row.action === 'buy') {
      totalCost += qty * price;
      totalShares += qty;
    } else if (row.action === 'sell') {
      if (totalShares > 0) {
        const avgCostAtSell = totalCost / totalShares;
        totalCost -= qty * avgCostAtSell;
        totalShares -= qty;
      }
    }
  }

  // Clamp to avoid floating point drift below zero
  if (totalShares <= 0) {
    totalShares = 0;
    totalCost = 0;
  }

  const { rows: holdingRows } = await sql`
    SELECT id FROM portfolio_holdings WHERE ticker = ${normalizedTicker} LIMIT 1
  `;

  if (totalShares <= 0) {
    // Auto-remove holding when all shares sold
    if (holdingRows[0]) {
      await sql`DELETE FROM portfolio_holdings WHERE ticker = ${normalizedTicker}`;
    }
    return null;
  }

  const avgCost = totalCost / totalShares;

  if (holdingRows[0]) {
    const { rows } = await sql`
      UPDATE portfolio_holdings
      SET quantity = ${totalShares}, purchase_price = ${avgCost}
      WHERE ticker = ${normalizedTicker}
      RETURNING id, ticker, label, quantity, purchase_price, created_at
    `;
    return mapHolding(rows[0]);
  } else {
    // Create holding if it doesn't exist (e.g. trade added without tracking symbol first)
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const { rows } = await sql`
      INSERT INTO portfolio_holdings (id, ticker, label, quantity, purchase_price, created_at)
      VALUES (${id}, ${normalizedTicker}, ${null}, ${totalShares}, ${avgCost}, ${createdAt})
      ON CONFLICT (ticker) DO UPDATE SET quantity = ${totalShares}, purchase_price = ${avgCost}
      RETURNING id, ticker, label, quantity, purchase_price, created_at
    `;
    return mapHolding(rows[0]);
  }
}

export async function updateSiteSettings(
  settings: Partial<SiteSettings>
): Promise<SiteSettings> {
  await ensureTables();
  const normalized = normalizeSettings(settings);
  const updatedAt = new Date().toISOString();
  await sql`
    INSERT INTO site_settings (id, data, updated_at)
    VALUES ('profile', ${JSON.stringify(normalized)}, ${updatedAt})
    ON CONFLICT (id)
    DO UPDATE SET data = ${JSON.stringify(normalized)}, updated_at = ${updatedAt}
  `;
  return normalized;
}
