'use client';
import { useLanguage } from '@/components/LanguageProvider';
import type { ChangeCondition } from '@/lib/api';
import { conditionText } from '@/lib/format';
import { assessmentText } from '@/lib/report-summary';

/**
 * What would change the verdict. Each condition was re-run through the deterministic assessment
 * rule, so the ones that would actually move the verdict are separated from the ones that would
 * only strengthen the evidence. Nothing here claims a change it cannot demonstrate.
 */
export function ChangeConditions({ items, onOpen }: { items: ChangeCondition[]; onOpen: (evidenceId: string) => void }) {
  const { language, t } = useLanguage();
  if (!items.length) return null;
  const decisive = items.filter((c) => c.wouldBecome !== null);
  const supporting = items.filter((c) => c.wouldBecome === null);

  const list = (group: ChangeCondition[]) => (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
      {group.map((c) => (
        <li key={c.checkId}>
          {conditionText(c, language)}
          {c.wouldBecome && (
            <>
              {' '}
              <strong>{t('Hasil penilaian akan menjadi')} {assessmentText(c.wouldBecome, language).toLowerCase()}.</strong>
            </>
          )}{' '}
          {c.evidenceId && (
            <button className="quiet small" style={{ padding: '2px 8px' }} onClick={() => onOpen(c.evidenceId!)}>
              {t('Lihat sumber')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{t('Apa yang bisa mengubah hasil')}</h3>
      {decisive.length > 0 && list(decisive)}
      {supporting.length > 0 && (
        <>
          <p className="small muted" style={{ margin: decisive.length ? '12px 0 6px' : '0 0 6px' }}>
            {decisive.length
              ? t('Perubahan berikut memperkuat bukti, tetapi masing-masing tidak mengubah hasil penilaian:')
              : t('Masing-masing perubahan berikut memperkuat bukti, tetapi belum cukup untuk mengubah hasil penilaian:')}
          </p>
          {list(supporting)}
        </>
      )}
    </div>
  );
}
