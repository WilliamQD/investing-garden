import 'server-only';

import { sql } from '@vercel/postgres';
import { randomUUID } from 'crypto';

export type EntryType = 'journal' | 'learning' | 'resources';

export interface Entry {
  id: string;
  title: string;
  content: string;
  url?: string;
  outcome?: string;
  emotion?: string;
  goal?: string;
  nextStep?: string;
  sourceType?: string;
  tags?: string[];
  ticker?: string;
  createdAt: string;
  updatedAt: string;
}

let initialized: Promise<void> | null = null;

const parseTags = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as string[];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

async function ensureTables() {
  if (!initialized) {
    initialized = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id text PRIMARY KEY,
          title text NOT NULL,
          content text NOT NULL,
          outcome text,
          emotion text,
          tags text,
          ticker text,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS learning_entries (
          id text PRIMARY KEY,
          title text NOT NULL,
          content text NOT NULL,
          goal text,
          next_step text,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS resource_entries (
          id text PRIMARY KEY,
          title text NOT NULL,
          content text NOT NULL,
          url text NOT NULL,
          source_type text,
          tags text,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `;
    })();
  }
  await initialized;
}

function mapRowToEntry(type: EntryType, row: Record<string, unknown>): Entry {
  const base = {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };

  if (type === 'journal') {
    return {
      ...base,
      outcome: (row.outcome as string) || undefined,
      emotion: (row.emotion as string) || undefined,
      tags: parseTags(row.tags),
      ticker: (row.ticker as string) || undefined,
    };
  }

  if (type === 'learning') {
    return {
      ...base,
      goal: (row.goal as string) || undefined,
      nextStep: (row.next_step as string) || undefined,
    };
  }

  return {
    ...base,
    url: (row.url as string) || undefined,
    sourceType: (row.source_type as string) || undefined,
    tags: parseTags(row.tags),
  };
}

class Storage {
  async initialize(): Promise<void> {
    await ensureTables();
  }

  async getAll(type: EntryType): Promise<Entry[]> {
    await ensureTables();
    if (type === 'journal') {
      const { rows } = await sql`SELECT * FROM journal_entries ORDER BY created_at DESC`;
      return rows.map(row => mapRowToEntry(type, row));
    }
    if (type === 'learning') {
      const { rows } = await sql`SELECT * FROM learning_entries ORDER BY created_at DESC`;
      return rows.map(row => mapRowToEntry(type, row));
    }
    const { rows } = await sql`SELECT * FROM resource_entries ORDER BY created_at DESC`;
    return rows.map(row => mapRowToEntry(type, row));
  }

  async getById(type: EntryType, id: string): Promise<Entry | undefined> {
    await ensureTables();
    if (type === 'journal') {
      const { rows } = await sql`SELECT * FROM journal_entries WHERE id = ${id}`;
      const row = rows[0];
      return row ? mapRowToEntry(type, row) : undefined;
    }
    if (type === 'learning') {
      const { rows } = await sql`SELECT * FROM learning_entries WHERE id = ${id}`;
      const row = rows[0];
      return row ? mapRowToEntry(type, row) : undefined;
    }
    const { rows } = await sql`SELECT * FROM resource_entries WHERE id = ${id}`;
    const row = rows[0];
    return row ? mapRowToEntry(type, row) : undefined;
  }

  async create(
    type: EntryType,
    entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Entry> {
    await ensureTables();
    const id = randomUUID();
    const now = new Date().toISOString();

    let result;
    if (type === 'journal') {
      result = await sql`
        INSERT INTO journal_entries (id, title, content, outcome, emotion, tags, ticker, created_at, updated_at)
        VALUES (${id}, ${entry.title}, ${entry.content}, ${entry.outcome ?? null}, ${entry.emotion ?? null}, ${entry.tags ? JSON.stringify(entry.tags) : null}, ${entry.ticker ?? null}, ${now}, ${now})
        RETURNING *
      `;
    } else if (type === 'learning') {
      result = await sql`
        INSERT INTO learning_entries (id, title, content, goal, next_step, created_at, updated_at)
        VALUES (${id}, ${entry.title}, ${entry.content}, ${entry.goal ?? null}, ${entry.nextStep ?? null}, ${now}, ${now})
        RETURNING *
      `;
    } else {
      result = await sql`
        INSERT INTO resource_entries (id, title, content, url, source_type, tags, created_at, updated_at)
        VALUES (${id}, ${entry.title}, ${entry.content}, ${entry.url ?? ''}, ${entry.sourceType ?? null}, ${entry.tags ? JSON.stringify(entry.tags) : null}, ${now}, ${now})
        RETURNING *
      `;
    }

    return mapRowToEntry(type, result.rows[0]);
  }

  async update(
    type: EntryType,
    id: string,
    updates: Partial<Omit<Entry, 'id' | 'createdAt'>>
  ): Promise<Entry | null> {
    await ensureTables();
    const now = new Date().toISOString();

    let result;
    if (type === 'journal') {
      result = await sql`
        UPDATE journal_entries
        SET title = ${updates.title ?? ''},
            content = ${updates.content ?? ''},
            outcome = ${updates.outcome ?? null},
            emotion = ${updates.emotion ?? null},
            tags = ${updates.tags ? JSON.stringify(updates.tags) : null},
            ticker = ${updates.ticker ?? null},
            updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (type === 'learning') {
      result = await sql`
        UPDATE learning_entries
        SET title = ${updates.title ?? ''},
            content = ${updates.content ?? ''},
            goal = ${updates.goal ?? null},
            next_step = ${updates.nextStep ?? null},
            updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE resource_entries
        SET title = ${updates.title ?? ''},
            content = ${updates.content ?? ''},
            url = ${updates.url ?? ''},
            source_type = ${updates.sourceType ?? null},
            tags = ${updates.tags ? JSON.stringify(updates.tags) : null},
            updated_at = ${now}
        WHERE id = ${id}
        RETURNING *
      `;
    }

    if (!result.rows[0]) return null;
    return mapRowToEntry(type, result.rows[0]);
  }

  async delete(type: EntryType, id: string): Promise<boolean> {
    await ensureTables();
    if (type === 'journal') {
      const result = await sql`DELETE FROM journal_entries WHERE id = ${id}`;
      return (result.rowCount ?? 0) > 0;
    }
    if (type === 'learning') {
      const result = await sql`DELETE FROM learning_entries WHERE id = ${id}`;
      return (result.rowCount ?? 0) > 0;
    }
    const result = await sql`DELETE FROM resource_entries WHERE id = ${id}`;
    return (result.rowCount ?? 0) > 0;
  }

  async replaceAll(type: EntryType, entries: Entry[]): Promise<void> {
    await ensureTables();
    if (type === 'journal') {
      await sql`DELETE FROM journal_entries`;
    } else if (type === 'learning') {
      await sql`DELETE FROM learning_entries`;
    } else {
      await sql`DELETE FROM resource_entries`;
    }
    for (const entry of entries) {
      const trimmedId = entry.id?.trim();
      const entryId = trimmedId ? trimmedId : randomUUID();
      const createdAt = entry.createdAt || new Date().toISOString();
      const updatedAt = entry.updatedAt || createdAt;

      if (type === 'journal') {
        await sql`
          INSERT INTO journal_entries (id, title, content, outcome, emotion, tags, ticker, created_at, updated_at)
          VALUES (${entryId}, ${entry.title}, ${entry.content}, ${entry.outcome ?? null}, ${entry.emotion ?? null}, ${entry.tags ? JSON.stringify(entry.tags) : null}, ${entry.ticker ?? null}, ${createdAt}, ${updatedAt})
        `;
      } else if (type === 'learning') {
        await sql`
          INSERT INTO learning_entries (id, title, content, goal, next_step, created_at, updated_at)
          VALUES (${entryId}, ${entry.title}, ${entry.content}, ${entry.goal ?? null}, ${entry.nextStep ?? null}, ${createdAt}, ${updatedAt})
        `;
      } else {
        await sql`
          INSERT INTO resource_entries (id, title, content, url, source_type, tags, created_at, updated_at)
          VALUES (${entryId}, ${entry.title}, ${entry.content}, ${entry.url ?? ''}, ${entry.sourceType ?? null}, ${entry.tags ? JSON.stringify(entry.tags) : null}, ${createdAt}, ${updatedAt})
        `;
      }
    }
  }
}

export const storage = new Storage();
