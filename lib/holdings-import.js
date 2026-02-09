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

const normalizeHoldingNumber = (value) => {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
};

const looksLikeHeader = (value) => {
  const lower = value.toLowerCase();
  return lower.includes('ticker') || lower.includes('symbol');
};

const splitCsvLine = (line) => {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
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
    const [tickerRaw, labelRaw, quantityRaw, purchasePriceRaw] = splitCsvLine(line);
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
    const label = normalizeHoldingLabel(labelRaw);
    const quantity = normalizeHoldingNumber(quantityRaw);
    if (quantity === null) {
      result.errors.push({ line: i + 1, message: 'Invalid quantity' });
      continue;
    }
    const purchasePrice = normalizeHoldingNumber(purchasePriceRaw);
    if (purchasePrice === null) {
      result.errors.push({ line: i + 1, message: 'Invalid purchase price' });
      continue;
    }
    const holding = { ticker };
    if (label) holding.label = label;
    if (quantity != null) holding.quantity = quantity;
    if (purchasePrice != null) holding.purchasePrice = purchasePrice;
    result.holdings.push(holding);
    seen.add(ticker);
  }

  return result;
};

module.exports = { parseHoldingsCsv, MAX_BULK_HOLDINGS };
