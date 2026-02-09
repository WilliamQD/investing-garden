/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { parseHoldingsCsv } = require('./holdings-import');

test('parseHoldingsCsv extracts valid holdings and reports issues', () => {
  const input = `ticker,label,quantity,purchasePrice
AAPL, Core position,10,150
MSFT,"Core, income",5,250
AAPL, Duplicate,1,100
BAD TICKER
`;

  const result = parseHoldingsCsv(input);

  assert.equal(result.holdings.length, 2);
  assert.deepEqual(result.holdings[0], {
    ticker: 'AAPL',
    label: 'Core position',
    quantity: 10,
    purchasePrice: 150,
  });
  assert.deepEqual(result.holdings[1], {
    ticker: 'MSFT',
    label: 'Core, income',
    quantity: 5,
    purchasePrice: 250,
  });
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 5);
});
