import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

import { storage } from '@/lib/storage';

const getCount = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export async function GET() {
  try {
    await storage.initialize();

    const [journalCount, learningCount, resourceCount] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM journal_entries`,
      sql`SELECT COUNT(*)::int AS count FROM learning_entries`,
      sql`SELECT COUNT(*)::int AS count FROM resource_entries`,
    ]);

    const outcomeRows = await sql`
      SELECT outcome, COUNT(*)::int AS count
      FROM journal_entries
      GROUP BY outcome
    `;
    const outcomes = outcomeRows.rows.reduce(
      (acc, row) => {
        const outcome = ((row.outcome as string | null) ?? 'open').toLowerCase();
        if (outcome.includes('win')) acc.win += getCount(row.count);
        else if (outcome.includes('loss')) acc.loss += getCount(row.count);
        else if (outcome.includes('flat')) acc.flat += getCount(row.count);
        else acc.open += getCount(row.count);
        return acc;
      },
      { win: 0, loss: 0, flat: 0, open: 0 }
    );

    const dailyJournal = await sql`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM journal_entries
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    const activity = await sql`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS count
      FROM (
        SELECT created_at FROM journal_entries
        UNION ALL
        SELECT created_at FROM learning_entries
        UNION ALL
        SELECT created_at FROM resource_entries
      ) AS entries
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    const topTags = await sql`
      SELECT tag, COUNT(*)::int AS count
      FROM (
        SELECT jsonb_array_elements_text(tags::jsonb) AS tag FROM journal_entries WHERE tags IS NOT NULL
        UNION ALL
        SELECT jsonb_array_elements_text(tags::jsonb) AS tag FROM resource_entries WHERE tags IS NOT NULL
      ) AS tags
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 8
    `;

    return NextResponse.json({
      totals: {
        journal: getCount(journalCount.rows[0]?.count),
        learning: getCount(learningCount.rows[0]?.count),
        resources: getCount(resourceCount.rows[0]?.count),
      },
      outcomes: {
        win: outcomes.win,
        loss: outcomes.loss,
        flat: outcomes.flat,
        open: outcomes.open,
      },
      dailyJournal: dailyJournal.rows.map(row => ({
        date: String(row.date),
        count: getCount(row.count),
      })),
      activity: activity.rows.map(row => ({
        date: String(row.date),
        count: getCount(row.count),
      })),
      topTags: topTags.rows.map(row => ({
        tag: row.tag,
        count: getCount(row.count),
      })),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
