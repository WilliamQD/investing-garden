/* eslint-disable @typescript-eslint/no-require-imports */
try {
  require('server-only');
} catch {
  // ignore when running outside Next.js
}

const { sql } = require('@vercel/postgres');
const logInfo = (event, details = {}) => {
  console.info(JSON.stringify({ level: 'info', event, ...details, timestamp: new Date().toISOString() }));
};

const logError = (event, error, details = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ level: 'error', event, message, ...details, timestamp: new Date().toISOString() })
  );
};

const MIGRATIONS_TABLE = 'schema_migrations';

/** @type {{ id: number; name: string; up: string[]; down: string[] }[]} */
const migrations = [
  {
    id: 1,
    name: 'init_core_tables',
    up: [
      `CREATE TABLE IF NOT EXISTS journal_entries (
        id text PRIMARY KEY,
        title text NOT NULL,
        content text NOT NULL,
        outcome text,
        emotion text,
        tags text,
        ticker text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS learning_entries (
        id text PRIMARY KEY,
        title text NOT NULL,
        content text NOT NULL,
        goal text,
        next_step text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS resource_entries (
        id text PRIMARY KEY,
        title text NOT NULL,
        content text NOT NULL,
        url text NOT NULL,
        source_type text,
        tags text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS journal_entries_created_at_idx
        ON journal_entries (created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS learning_entries_created_at_idx
        ON learning_entries (created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS resource_entries_created_at_idx
        ON resource_entries (created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        snapshot_date date PRIMARY KEY,
        value numeric NOT NULL,
        updated_at timestamptz NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS portfolio_holdings (
        id text PRIMARY KEY,
        ticker text NOT NULL,
        label text,
        created_at timestamptz NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS portfolio_holdings_ticker_idx
        ON portfolio_holdings (ticker)`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      )`,
    ],
    down: [
      'DROP INDEX IF EXISTS portfolio_holdings_ticker_idx',
      'DROP INDEX IF EXISTS resource_entries_created_at_idx',
      'DROP INDEX IF EXISTS learning_entries_created_at_idx',
      'DROP INDEX IF EXISTS journal_entries_created_at_idx',
      'DROP TABLE IF EXISTS site_settings',
      'DROP TABLE IF EXISTS portfolio_holdings',
      'DROP TABLE IF EXISTS portfolio_snapshots',
      'DROP TABLE IF EXISTS resource_entries',
      'DROP TABLE IF EXISTS learning_entries',
      'DROP TABLE IF EXISTS journal_entries',
    ],
  },
  {
    id: 2,
    name: 'add_holding_position_fields',
    up: [
      'ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS quantity numeric(20,8)',
      'ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS purchase_price numeric(20,8)',
    ],
    down: [
      'ALTER TABLE portfolio_holdings DROP COLUMN IF EXISTS purchase_price',
      'ALTER TABLE portfolio_holdings DROP COLUMN IF EXISTS quantity',
    ],
  },
];

const checkMigrations = () => {
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error('No migrations defined.');
  }
  const ids = new Set();
  migrations.forEach((migration, index) => {
    if (!Number.isInteger(migration.id) || migration.id <= 0) {
      throw new Error(`Migration id must be a positive integer (got ${migration.id}).`);
    }
    if (ids.has(migration.id)) {
      throw new Error(`Duplicate migration id detected: ${migration.id}.`);
    }
    ids.add(migration.id);
    if (!migration.name) {
      throw new Error(`Migration ${migration.id} is missing a name.`);
    }
    if (!Array.isArray(migration.up) || migration.up.length === 0) {
      throw new Error(`Migration ${migration.id} has no up statements.`);
    }
    if (!Array.isArray(migration.down) || migration.down.length === 0) {
      throw new Error(`Migration ${migration.id} has no down statements.`);
    }
    if (index > 0 && migration.id <= migrations[index - 1].id) {
      throw new Error('Migrations must be sorted by ascending id.');
    }
  });
};

const ensureMigrationsTable = async (client) => {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`
  );
};

const runMigrations = async () => {
  checkMigrations();
  const client = await sql.connect();
  let currentMigration = null;
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`
    );
    const applied = new Set(rows.map(row => Number(row.id)));
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      currentMigration = migration;
      for (const statement of migration.up) {
        await client.query(statement);
      }
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (id, name) VALUES ($1, $2)`,
        [migration.id, migration.name]
      );
      logInfo('migration_applied', { id: migration.id, name: migration.name });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logError('migration_failed', error, {
      migrationId: currentMigration?.id,
      migrationName: currentMigration?.name,
    });
    throw error;
  } finally {
    client.release();
  }
};

let migrationPromise = null;

const ensureMigrations = async () => {
  if (!migrationPromise) {
    migrationPromise = runMigrations();
  }
  await migrationPromise;
};

const rollbackMigration = async (targetId) => {
  checkMigrations();
  const client = await sql.connect();
  let currentMigration = null;
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY id DESC`
    );
    const appliedIds = rows.map(row => Number(row.id));
    const migrationsToRollback = migrations
      .filter(migration => appliedIds.includes(migration.id))
      .filter(migration => (targetId ? migration.id >= targetId : true))
      .sort((a, b) => b.id - a.id);
    for (const migration of migrationsToRollback) {
      currentMigration = migration;
      for (const statement of migration.down) {
        await client.query(statement);
      }
      await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE id = $1`, [migration.id]);
      logInfo('migration_rolled_back', { id: migration.id, name: migration.name });
      if (targetId && migration.id === targetId) {
        break;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logError('migration_rollback_failed', error, {
      migrationId: currentMigration?.id,
      migrationName: currentMigration?.name,
    });
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  migrations,
  checkMigrations,
  ensureMigrations,
  runMigrations,
  rollbackMigration,
};
