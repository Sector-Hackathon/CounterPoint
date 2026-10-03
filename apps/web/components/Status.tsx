import type { Assessment } from '@/lib/api';

export const ASSESSMENT_TEXT: Record<Assessment | 'PENDING', string> = {
  SUPPORTED: 'Supported',
  PARTIALLY_SUPPORTED: 'Partly supported',
  NOT_SUPPORTED: 'Not supported',
  UNVERIFIABLE: 'Can’t be checked',
  PENDING: 'Checking',
};

export function Status({ value }: { value: Assessment | null }) {
  const v = value ?? 'PENDING';
  return <span className="status" data-s={v}>{ASSESSMENT_TEXT[v]}</span>;
}
