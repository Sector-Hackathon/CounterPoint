import type { Assessment } from '@/lib/api';

const LABELS: Record<Assessment, { symbol: string; label: string }> = {
  SUPPORTED: { symbol: '●', label: 'Supported' },
  PARTIALLY_SUPPORTED: { symbol: '◐', label: 'Partially supported' },
  NOT_SUPPORTED: { symbol: '○', label: 'Not supported' },
  UNVERIFIABLE: { symbol: '?', label: 'Unverifiable' },
};

/** Status is conveyed by text and symbol, never colour alone, and avoids buy/sell-style green/red. */
export function AssessmentBadge({ value }: { value: Assessment | null }) {
  if (!value) return <span className="tag">Not assessed yet</span>;
  const { symbol, label } = LABELS[value];
  return (
    <span className="status" data-s={value}>
      <span aria-hidden="true">{symbol}</span>
      {label}
    </span>
  );
}
