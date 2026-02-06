const MAX_BULK_HOLDINGS = 50;
const MAX_TICKER_LENGTH = 10;
const MAX_LABEL_LENGTH = 60;
const TICKER_PATTERN = /^[A-Z0-9.-]+$/;

const normalizeHoldingTicker = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed.length > MAX_TICKER_LENGTH) return undefined;
  if (!TICKER_PATTERN.test(trimmed)) return undefined;
  return trimmed;
};

const normalizeHoldingLabel = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_LABEL_LENGTH) return trimmed.slice(0, MAX_LABEL_LENGTH);
  return trimmed;
};

const looksLikeHeader = (value) => {
  const lower = value.toLowerCase();
  return lower.includes('ticker') || lower.includes('symbol');
};

const parseHoldingsCsv = (input, maxHoldings = MAX_BULK_HOLDINGS) => {
  const result = { holdings: [], errors: [], skipped: 0 };
  if (typeof input !== 'string' || !input.trim()) {
    return result;
  }

  const lines = input.split(/\r?\n/);
  const seen = new Set();
  let headerChecked = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    if (!headerChecked) {
      headerChecked = true;
      if (looksLikeHeader(line)) {
        continue;
      }
    }
    const [tickerRaw, ...labelParts] = line.split(',');
    const ticker = normalizeHoldingTicker(tickerRaw);
    if (!ticker) {
      result.errors.push({ line: i + 1, message: 'Invalid ticker' });
      continue;
    }
    if (seen.has(ticker)) {
      result.skipped += 1;
      continue;
    }
    if (result.holdings.length >= maxHoldings) {
      result.errors.push({
        line: i + 1,
        message: `Cannot import more than ${maxHoldings} holdings at once.`,
      });
      break;
    }
    const label = normalizeHoldingLabel(labelParts.join(','));
    result.holdings.push(label ? { ticker, label } : { ticker });
    seen.add(ticker);
  }

  return result;
};

module.exports = { parseHoldingsCsv, MAX_BULK_HOLDINGS };
