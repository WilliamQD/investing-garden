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
  createdAt: string;
}

export interface SiteSettings {
  headline: string;
  summary: string;
  focusAreas: string[];
}

const DEFAULT_SETTINGS: SiteSettings = {
  headline: 'Investing Garden',
  summary:
    'A clean, industrial workspace for tracking portfolio moves, market context, and research notes in one place.',
  focusAreas: [],
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
  return {
    headline,
    summary,
    focusAreas,
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
    SELECT id, ticker, label, created_at
    FROM portfolio_holdings
    ORDER BY created_at DESC
  `;
  return rows.map(row => mapHolding(row));
}

export async function addHolding(ticker: string, label?: string): Promise<Holding> {
  await ensureTables();
  const normalizedTicker = ticker.trim().toUpperCase();
  const { rows: existing } = await sql`
    SELECT id, ticker, label, created_at
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
    INSERT INTO portfolio_holdings (id, ticker, label, created_at)
    VALUES (${id}, ${normalizedTicker}, ${label ?? null}, ${createdAt})
    ON CONFLICT (ticker)
    DO UPDATE SET label = COALESCE(EXCLUDED.label, portfolio_holdings.label)
    RETURNING id, ticker, label, created_at
  `;
  return mapHolding(rows[0]);
}

export async function addHoldings(holdings: { ticker: string; label?: string }[]): Promise<Holding[]> {
  await ensureTables();
  if (!holdings.length) return [];
  const values: (string | null)[] = [];
  const rows = holdings.map((holding, index) => {
    const id = randomUUID();
    const normalizedTicker = holding.ticker.trim().toUpperCase();
    const createdAt = new Date().toISOString();
    const offset = index * 4;
    values.push(id, normalizedTicker, holding.label ?? null, createdAt);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });
  const query = `
    INSERT INTO portfolio_holdings (id, ticker, label, created_at)
    VALUES ${rows.join(', ')}
    ON CONFLICT (ticker)
    DO UPDATE SET label = COALESCE(EXCLUDED.label, portfolio_holdings.label)
    RETURNING id, ticker, label, created_at
  `;
  const result = await sql.query(query, values);
  return result.rows.map(row => mapHolding(row));
}

export async function deleteHolding(id: string): Promise<boolean> {
  await ensureTables();
  const result = await sql`
    DELETE FROM portfolio_holdings WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function updateHoldingLabel(id: string, label: string | null): Promise<Holding | null> {
  await ensureTables();
  const { rows } = await sql`
    UPDATE portfolio_holdings
    SET label = ${label}
    WHERE id = ${id}
    RETURNING id, ticker, label, created_at
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
