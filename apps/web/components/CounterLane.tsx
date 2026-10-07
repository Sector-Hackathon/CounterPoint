'use client';
import { useLanguage } from '@/components/LanguageProvider';
import type { StepEvent } from '@/lib/api';
import { formatValue, isHeadlineMetric, metricLabel } from '@/lib/format';

const VERDICT: Record<string, string> = {
  weakens: 'Ya, data mendukung alasan tandingan ini.',
  neutral: 'Data tidak mendukung alasan tandingan ini.',
  supports: 'Data tidak mendukung alasan tandingan ini.',
};

/** Hypotheses the agent has chosen to test, filled as their evidence arrives. */
export function CounterLane({ steps, finished }: { steps: StepEvent[]; finished: boolean }) {
  const { language, t } = useLanguage();
  const tested = steps.filter((s) => s.phase === 'counterpoint' && s.action.startsWith('get_'));
  if (!tested.length) {
    // Once the claim is settled with no counter-case, the contract never opened one — the claim
    // did not survive its own checks, so there was nothing left to argue against.
    return (
      <p className="muted small">
        {finished
          ? t('Klaim sudah gagal pada pemeriksaan dasarnya, sehingga alasan tandingan tambahan tidak diperlukan.')
          : t('Alasan tandingan diuji setelah pemeriksaan dasar klaim selesai.')}
      </p>
    );
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
      {tested.map((s) => {
        // The check's own derived metric is the last headline item it produced.
        const metric = [...s.evidence].reverse().find((e) => isHeadlineMetric(e.metric));
        const confirmed = s.outcome === 'weakens';
        return (
          <li
            key={s.id}
            className="sheet"
            style={{ padding: 16, boxShadow: `inset 3px 0 0 ${confirmed ? 'var(--counter)' : 'var(--rule)'}` }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>{s.question ? t(s.question) : null}</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              {s.outcome ? (
                <strong className={confirmed ? 'voice-counter' : undefined}>{t(VERDICT[s.outcome]!)}</strong>
              ) : (
                <span className="muted">{t('Belum bisa diuji dengan data yang tersedia.')}</span>
              )}
            </p>
            {metric && (
              <p className="small muted tabular" style={{ margin: '4px 0 0' }}>
                {metricLabel(metric.metric, language)}: {formatValue(metric.value, metric.unit)}
                {metric.status !== 'VALID' && metric.note ? ` · ${t(metric.note)}` : ''}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
