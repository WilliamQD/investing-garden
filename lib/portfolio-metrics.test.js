/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { getPerformanceHighlights } = require('./portfolio-metrics');

test('getPerformanceHighlights computes period deltas and cadence', () => {
  const points = [
    { date: '2025-01-01', value: 100 },
    { date: '2025-01-08', value: 110 },
    { date: '2025-01-31', value: 130 },
    { date: '2025-02-01', value: 140 },
    { date: '2025-02-08', value: 150 },
  ];

  const highlights = getPerformanceHighlights(points, new Date('2025-02-10T12:00:00Z'));
  const sevenDay = highlights.periods.find(period => period.label === '7D');
  const thirtyDay = highlights.periods.find(period => period.label === '30D');
  const ytd = highlights.periods.find(period => period.label === 'YTD');

  assert.equal(sevenDay.delta, 10);
  assert.equal(Number(sevenDay.deltaPercent.toFixed(1)), 7.1);
  assert.equal(thirtyDay.delta, 40);
  assert.equal(Number(thirtyDay.deltaPercent.toFixed(1)), 36.4);
  assert.equal(ytd.delta, 50);
  assert.equal(ytd.deltaPercent, 50);
  assert.equal(highlights.cadence.averageGapDays, 9.5);
  assert.equal(highlights.cadence.daysSinceLast, 2);
});

test('getPerformanceHighlights handles insufficient history', () => {
  const highlights = getPerformanceHighlights([{ date: '2025-01-05', value: 100 }]);

  assert.equal(highlights.periods[0].delta, null);
  assert.equal(highlights.cadence.averageGapDays, null);
  assert.equal(highlights.cadence.daysSinceLast, null);
});

test('getPerformanceHighlights ignores invalid dates', () => {
  const highlights = getPerformanceHighlights([
    { date: 'not-a-date', value: 100 },
    { date: '2025-01-05', value: 100 },
    { date: '2025-01-06', value: 110 },
  ]);

  assert.equal(highlights.cadence.lastSnapshotDate, '2025-01-06');
});
