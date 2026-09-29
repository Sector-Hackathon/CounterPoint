import { CircleCheck, CircleDashed, CircleHelp, CircleSlash } from 'lucide-react';
import type { Assessment } from '@/lib/api';

const LABELS: Record<Assessment, { icon: typeof CircleCheck; label: string }> = {
  SUPPORTED: { icon: CircleCheck, label: 'Supported' },
  PARTIALLY_SUPPORTED: { icon: CircleDashed, label: 'Partially supported' },
  NOT_SUPPORTED: { icon: CircleSlash, label: 'Not supported' },
  UNVERIFIABLE: { icon: CircleHelp, label: 'Unverifiable' },
};

/** Status is conveyed by text and icon, never colour alone, and avoids buy/sell-style green/red. */
export function AssessmentBadge({ value }: { value: Assessment | null }) {
  if (!value) return <span className="tag">Not assessed yet</span>;
  const { icon: Icon, label } = LABELS[value];
  return (
    <span className="status" data-s={value}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
