'use client';

interface FiftyTwoWeekRangeProps {
  low: number | undefined;
  high: number | undefined;
  current: number | undefined;
  currency?: string;
}

export default function FiftyTwoWeekRange({ low, high, current, currency = 'USD' }: FiftyTwoWeekRangeProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  if (low == null || high == null || current == null || !Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(current)) {
    return <p className="fifty-two-week-message">52-week range unavailable</p>;
  }

  const range = high - low;
  const percentage = range > 0 ? Math.min(Math.max(((current - low) / range) * 100, 0), 100) : 50;

  return (
    <div className="fifty-two-week-range">
      <div className="fifty-two-week-header">
        <span>52-week range</span>
      </div>
      <div className="fifty-two-week-bar-container">
        <span className="fifty-two-week-label">{formatCurrency(low)}</span>
        <div className="fifty-two-week-bar">
          <div className="fifty-two-week-track" />
          <div
            className="fifty-two-week-marker"
            style={{ left: `${percentage}%` }}
            title={`Current: ${formatCurrency(current)}`}
          />
        </div>
        <span className="fifty-two-week-label">{formatCurrency(high)}</span>
      </div>
    </div>
  );
}
