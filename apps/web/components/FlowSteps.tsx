'use client';
import { Check } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export function FlowSteps({ current }: { current: 0 | 1 | 2 }) {
  const { t } = useLanguage();
  return <nav aria-label={t('Tahapan pemeriksaan')}>
    <ol className="flow-steps">
      {['Masukkan pesan', 'Periksa bukti', 'Baca hasil'].map((label, index) => <li key={label} data-state={index < current ? 'done' : index === current ? 'current' : 'next'} aria-current={index === current ? 'step' : undefined}>
        <span className="step-number">{index < current ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
        <span>{t(label)}</span>
      </li>)}
    </ol>
  </nav>;
}
