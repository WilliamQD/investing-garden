/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { parseHoldingsCsv } = require('./holdings-import');

test('parseHoldingsCsv extracts valid holdings and reports issues', () => {
  const input = `ticker,label
AAPL, Core position
MSFT
AAPL, Duplicate
BAD TICKER
`;

  const result = parseHoldingsCsv(input);

  assert.equal(result.holdings.length, 2);
  assert.deepEqual(result.holdings[0], { ticker: 'AAPL', label: 'Core position' });
  assert.deepEqual(result.holdings[1], { ticker: 'MSFT' });
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 5);
});
