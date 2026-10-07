'use client';
import type { Assessment } from '@/lib/api';
import { assessmentText } from '@/lib/report-summary';
import { useLanguage } from './LanguageProvider';
export { ASSESSMENT_TEXT } from '@/lib/report-summary';

export function Status({ value }: { value: Assessment | null }) {
  const { language } = useLanguage();
  const v = value ?? 'PENDING';
  return <span className="status" data-s={v}>{assessmentText(v, language)}</span>;
}
