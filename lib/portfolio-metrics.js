/**
 * @typedef {Object} PortfolioPoint
 * @property {string} date
 * @property {number} value
 */

/**
 * @typedef {Object} PerformancePeriod
 * @property {string} label
 * @property {number | null} delta
 * @property {number | null} deltaPercent
 * @property {string | null} startDate
 * @property {string | null} endDate
 * @property {boolean} isPartial
 */

/**
 * @typedef {Object} CadenceSummary
 * @property {number | null} averageGapDays
 * @property {number | null} daysSinceLast
 * @property {string | null} lastSnapshotDate
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value) => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
};

const toUtcDate = (value) => new Date(`${value}T00:00:00Z`);
const formatIsoDate = (date) => date.toISOString().slice(0, 10);

const daysBetween = (startDate, endDate) =>
  Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);

const findPointOnOrBefore = (points, targetIso) => {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].date <= targetIso) {
      return points[i];
    }
  }
  return null;
};

const buildPeriod = (label, startDate, points, earliest, latest) => {
  const targetIso = formatIsoDate(startDate);
  const startPoint = findPointOnOrBefore(points, targetIso) ?? earliest;
  const hasHistory = points.length > 1 && startPoint && startPoint.date !== latest.date;
  if (!hasHistory) {
    return {
      label,
      delta: null,
      deltaPercent: null,
      startDate: startPoint?.date ?? null,
      endDate: latest.date ?? null,
      isPartial: true,
    };
  }
  const delta = latest.value - startPoint.value;
  // Avoid infinite growth when the base value is zero; use null instead.
  const denominator = startPoint.value;
  const deltaPercent = denominator !== 0 ? (delta / denominator) * 100 : null;
  return {
    label,
    delta,
    deltaPercent,
    startDate: startPoint.date,
    endDate: latest.date,
    isPartial: startPoint.date > targetIso,
  };
};

/**
 * Compute portfolio performance highlights and snapshot cadence from ordered points.
 * @param {PortfolioPoint[]} points
 * @param {Date} [today]
 * @returns {{ periods: PerformancePeriod[]; cadence: CadenceSummary }}
 */
function getPerformanceHighlights(points, today = new Date()) {
  const orderedPoints = Array.isArray(points)
    ? points
        .filter(
          point =>
            point &&
            typeof point.date === 'string' &&
            isValidIsoDate(point.date) &&
            Number.isFinite(point.value)
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  if (!orderedPoints.length) {
    return {
      periods: [
        { label: '7D', delta: null, deltaPercent: null, startDate: null, endDate: null, isPartial: true },
        { label: '30D', delta: null, deltaPercent: null, startDate: null, endDate: null, isPartial: true },
        { label: 'YTD', delta: null, deltaPercent: null, startDate: null, endDate: null, isPartial: true },
      ],
      cadence: { averageGapDays: null, daysSinceLast: null, lastSnapshotDate: null },
    };
  }

  const earliest = orderedPoints[0];
  const latest = orderedPoints[orderedPoints.length - 1];
  const latestDate = toUtcDate(latest.date);
  const startOfYear = new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1));

  const periods = [
    buildPeriod('7D', new Date(latestDate.getTime() - 7 * MS_PER_DAY), orderedPoints, earliest, latest),
    buildPeriod('30D', new Date(latestDate.getTime() - 30 * MS_PER_DAY), orderedPoints, earliest, latest),
    buildPeriod('YTD', startOfYear, orderedPoints, earliest, latest),
  ];

  const gaps = [];
  for (let i = 1; i < orderedPoints.length; i += 1) {
    const gap = daysBetween(toUtcDate(orderedPoints[i - 1].date), toUtcDate(orderedPoints[i].date));
    gaps.push(Math.max(0, gap));
  }

  const averageGapDays = gaps.length
    ? Number((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length).toFixed(1))
    : null;
  const hasCadenceHistory = orderedPoints.length > 1;
  const todayDate = today instanceof Date ? today : new Date(today);
  const todayUtc = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), todayDate.getUTCDate()));
  const daysSinceLast = hasCadenceHistory ? Math.max(0, daysBetween(latestDate, todayUtc)) : null;

  return {
    periods,
    cadence: {
      averageGapDays,
      daysSinceLast: Number.isFinite(daysSinceLast) ? daysSinceLast : null,
      lastSnapshotDate: latest.date,
    },
  };
}

module.exports = { getPerformanceHighlights };
