'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useState } from 'react';
import type { Assessment, EvidenceItem, ReportView } from '@/lib/api';
import { assessmentText, buildShareText, dataModeLabel, retrievalLabel, summarizeReport } from '@/lib/report-summary';
import { formatValue, isHeadlineMetric, metricLabel } from '@/lib/format';
import type { Language } from '@/lib/locale';
import { Copy } from 'lucide-react';

export function ReportSummary({ report, quotes, evidence, evidenceReady, dataMode, partial }: {
  report: ReportView;
  quotes: Record<string, string>;
  evidence: EvidenceItem[];
  evidenceReady: boolean;
  dataMode: 'live' | 'fixture' | null;
  partial: boolean;
}) {
  const { language, t } = useLanguage();
  const summary = summarizeReport(report);
  const findings = (['weakens', 'supports'] as const).flatMap((kind) => {
    const claim = report.claims.find((c) => c[kind].length > 0);
    if (!claim) return [];
    const ids = claim[kind].flatMap((s) => s.evidenceIds);
    const metric = evidence.find((e) => ids.includes(e.id) && e.status === 'VALID' && isHeadlineMetric(e.metric));
    return [{ kind, claim, metric }];
  });
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const [manualUrl, setManualUrl] = useState('');
  const [copiedLanguage, setCopiedLanguage] = useState<Language | null>(null);
  async function copy() {
    setCopyState('copying');
    const text = buildShareText({ report, quotes, evidence, dataMode, partial, language, url: window.location.href });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLanguage(language);
      setCopyState('copied');
      setManualUrl('');
    } catch {
      setManualUrl(window.location.href);
      setCopyState('manual');
    }
  }
  return (
    <section className="sheet" aria-labelledby="summary-title" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 id="summary-title" style={{ fontSize: '1.6rem' }}>{t('Ringkasan pemeriksaan')}</h1>
        <button className="quiet" onClick={() => void copy()} disabled={!evidenceReady || copyState === 'copying'}>
          <Copy size={16} aria-hidden="true" />
          {copyState === 'copying' ? t('Menyalin…') : t('Salin hasil untuk dibagikan')}
        </button>
      </div>
      <p style={{ margin: 0 }}>{t('{count} klaim dinilai berdasarkan bukti dan aturan pemeriksaan.', { count: summary.total })}</p>
      <ul className="summary-counts">
        {(Object.keys(summary.counts) as Assessment[]).map((status) => (
          <li key={status}>
            <strong className="tabular">{summary.counts[status]}</strong>
            <span className="status" data-s={status}>{assessmentText(status, language)}</span>
          </li>
        ))}
      </ul>
      {findings.length > 0 && <div>
        <h2 style={{ fontSize: '1.1rem' }}>{t('Temuan utama')}</h2>
        <ul style={{ paddingLeft: 18, marginBottom: 0, display: 'grid', gap: 8 }}>
          {findings.map(({ kind, claim, metric }) => <li key={kind}>
            <a href={`#claim-${claim.claimId}`}>{quotes[claim.claimId] ?? t('Lihat klaim')}</a>: {kind === 'weakens' ? t('ada bukti yang melemahkan') : t('ada bukti pendukung')}.
            {metric && <span className="small tabular">{' '}{metricLabel(metric.metric, language)}: {formatValue(metric.value, metric.unit)}{metric.economicPeriod ? ` (${metric.economicPeriod}${metric.comparisonPeriod ? ` ${t('dibanding')} ${metric.comparisonPeriod}` : ''})` : ''}.</span>}
          </li>)}
        </ul>
      </div>}
      <p className="small muted" style={{ margin: 0 }}>{t('Status menunjukkan dukungan bukti terhadap klaim, bukan peluang harga saham akan naik. Detail pendukung dan pelemah tersedia di setiap klaim di bawah.')}</p>
      {(summary.partial || partial) && <p role="note" className="notice">{t('Sebagian pemeriksaan belum lengkap. Perhatikan data yang belum tersedia dan batas pemeriksaan pada laporan.')}</p>}
      {report.validationStatus === 'REPAIRED' && <p className="small muted" style={{ margin: 0 }}>{t('Sebagian pernyataan dihapus karena tidak lolos validasi bukti.')}</p>}
      {report.validationStatus === 'FAILED' && <p role="alert" className="notice">{t('Validasi laporan gagal. Hasil belum dapat diandalkan.')}</p>}
      <p className="small muted" style={{ margin: 0 }}>{dataModeLabel(dataMode, language)} · {evidenceReady ? `${t('Data diambil')}: ${retrievalLabel(evidence, language)}` : t('Memuat waktu pengambilan data…')}</p>
      <p className="small" role="status" style={{ margin: 0 }}>
        {copyState === 'copied' && copiedLanguage === language ? t('Hasil dan tautan laporan sudah disalin. Kamu bisa menempelkannya di grup.') : copyState === 'manual' ? t('Browser tidak mengizinkan salin otomatis. Pilih dan salin teks di bawah.') : ''}
      </p>
      {manualUrl && <label style={{ display: 'grid', gap: 8 }}>{t('Ringkasan untuk disalin')}
        <textarea readOnly value={buildShareText({ report, quotes, evidence, dataMode, partial, language, url: manualUrl })} rows={10} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', font: 'inherit', padding: 12, color: 'var(--ink)', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 'var(--r-chip)' }} />
      </label>}
    </section>
  );
}
