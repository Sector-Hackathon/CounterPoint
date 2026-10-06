'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { budgetUse, type ClaimState } from '@/lib/session-state';

export function BudgetMeter({ claim }: { claim: ClaimState }) {
  const { t } = useLanguage();
  const u = budgetUse(claim);
  return (
    <p className="small muted" style={{ margin: 0 }}>
      {t('Pengambilan data')} {u.toolCalls} {t('dari')} 8 · {t('Perubahan langkah')} {u.replans} {t('dari')} 2 · {t('Uji alasan tandingan')} {u.counterpoints} {t('dari')} 3
    </p>
  );
}
