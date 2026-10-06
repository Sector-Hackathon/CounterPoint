'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type EvidenceItem, type ReportView, type SessionView } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import { VerdictCard } from '@/components/VerdictCard';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { DataModeBanner } from '@/components/DataModeBanner';
import { ReportSummary } from '@/components/ReportSummary';

export default function Report() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { state } = useSessionEvents(id);
  const [report, setReport] = useState<ReportView | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceReady, setEvidenceReady] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [open, setOpen] = useState<EvidenceItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<'live' | 'fixture' | null>(null);
  const [snapshot, setSnapshot] = useState<SessionView | null>(null);

  useEffect(() => {
    api.getSession(id).then((s) => { setDataMode(s.dataMode); setSnapshot(s); }).catch(() => setDataMode(null));
  }, [id]);

  useEffect(() => {
    if (!state.reportId) return;
    api.getReport(id).then(setReport).catch((e: Error) => setError(e.message));
  }, [id, state.reportId]);

  useEffect(() => {
    if (!report) return;
    let active = true;
    setEvidenceReady(false);
    setEvidenceError(null);
    Promise.all(report.claims.map((c) => api.getEvidence(c.claimId).then((r) => r.items)))
      .then((xs) => { if (active) { setEvidence(xs.flat()); setEvidenceReady(true); } })
      .catch(() => { if (active) setEvidenceError('Bukti belum berhasil dimuat. Muat ulang halaman untuk melihat sumber dan menyalin hasil.'); });
    return () => { active = false; };
  }, [report]);

  const onOpen = useCallback((evidenceId: string) => setOpen(evidence.find((e) => e.id === evidenceId) ?? null), [evidence]);
  const closeDrawer = useCallback(() => setOpen(null), []);
  const quotes = Object.fromEntries([...(snapshot?.claims ?? []), ...state.claims].map((c) => [c.id, c.originalText]));
  const quoteOf = (claimId: string) => quotes[claimId] ?? '';

  return (
    <main className="page" style={{ display: 'grid', gap: 28 }}>
      <p><a href={`/t/${id}`}>{t('Kembali ke pemeriksaan')}</a></p>
      <DataModeBanner mode={dataMode} />
      {report && <ReportSummary report={report} quotes={quotes} evidence={evidence} evidenceReady={evidenceReady} dataMode={dataMode} partial={state.status === 'PARTIAL' || snapshot?.status === 'PARTIAL'} />}
      {evidenceError && <p role="alert">{t(evidenceError)}</p>}
      {(state.rawThesis || snapshot?.rawThesis) && <blockquote style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.3rem', maxWidth: '50ch' }}>{state.rawThesis || snapshot?.rawThesis}</blockquote>}
      {error && <p role="alert">{error}</p>}
      {!report && !error && !state.reportId && ['FAILED', 'PARTIAL', 'COMPLETED'].includes(state.status) && (
        <p role="alert">
          {t('Pemeriksaan berakhir tanpa laporan')}{state.error ? `: ${state.error}` : '.'} <a href="/">{t('Cek pesan lagi')}</a>
        </p>
      )}
      {!report && !error && !['FAILED', 'PARTIAL', 'COMPLETED'].includes(state.status) && (
        <p className="muted" aria-live="polite">{t('Laporan akan muncul setelah pemeriksaan selesai.')}</p>
      )}
      {report?.claims.map((c) => <VerdictCard key={c.claimId} quote={quoteOf(c.claimId)} report={c} onOpen={onOpen} />)}
      {report && <p className="small muted">{t('Informasi dan analisis saja, bukan rekomendasi beli, jual, atau tahan saham.')}</p>}
      <EvidenceDrawer item={open} all={evidence} onClose={closeDrawer} />
    </main>
  );
}
