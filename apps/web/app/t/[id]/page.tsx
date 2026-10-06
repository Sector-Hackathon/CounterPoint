'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import { ThesisSplit } from '@/components/ThesisSplit';
import { ConfirmCompany } from '@/components/ConfirmCompany';
import { Status } from '@/components/Status';
import { BudgetMeter } from '@/components/BudgetMeter';
import { ReasoningThread } from '@/components/ReasoningThread';
import { CounterLane } from '@/components/CounterLane';
import { DataModeBanner } from '@/components/DataModeBanner';
import { FlowSteps } from '@/components/FlowSteps';
import { AgentFlow } from '@/components/AgentFlow';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function Investigation() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { state, connection } = useSessionEvents(id);
  const [view, setView] = useState<'summary' | 'flow'>('summary');
  const [settled, setSettled] = useState(false);
  const [dataMode, setDataMode] = useState<'live' | 'fixture' | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    api.getSession(id).then((s) => setDataMode(s.dataMode)).catch(() => setDataMode(null));
  }, [id]);

  // Hold the highlighted quotes for a beat, then let them lift into rows. Driven by the real claims event.
  useEffect(() => {
    if (!state.claims.length || settled) return;
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, [state.claims.length, settled]);

  // Start investigating as soon as claims are ready (endpoint is idempotent).
  useEffect(() => {
    if (state.status === 'CLAIMS_EXTRACTED') {
      api.investigate(id).catch((error: Error) => setStartError(error.message));
    }
  }, [state.status, id]);

  const terminal = ['COMPLETED', 'PARTIAL', 'FAILED'].includes(state.status);
  const completed = state.claims.filter((c) => c.assessment !== null && c.verifiability !== 'NO').length;
  const checkable = state.claims.filter((c) => c.verifiability !== 'NO').length;
  const statusLabel = state.status === 'FAILED' ? 'Pemeriksaan terhenti'
    : state.status === 'PARTIAL' ? 'Pemeriksaan selesai sebagian'
    : state.reportId || state.status === 'COMPLETED' ? 'Pemeriksaan selesai'
    : state.status === 'AWAITING_CONFIRMATION' ? 'Konfirmasi saham terlebih dahulu'
    : state.status === 'INVESTIGATING' ? 'Memeriksa bukti dari dua sisi'
    : 'Membaca pesan dan mengenali klaim';

  return (
    <main id="main-content" className="page investigation-page">
      <FlowSteps current={1} />
      <Link href="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" />{t('Kembali ke input')}</Link>
      <section className="session-status" aria-labelledby="investigation-title">
        <div role="status">
          <h1 id="investigation-title">{t(statusLabel)}</h1>
          <p>{checkable ? t('{completed} dari {total} klaim telah dinilai.', { completed, total: checkable }) : t(terminal ? 'Sesi telah berakhir. Lihat pesan asli dan informasi yang tersedia di bawah.' : 'Klaim dan perusahaan sedang dikenali dari pesanmu.')}</p>
          {state.status === 'PARTIAL' && <p>{t('Sebagian pemeriksaan belum lengkap. Baca batasannya di laporan.')}</p>}
        </div>
        {state.reportId && <Link className="button primary" href={`/t/${id}/report`}>{t('Baca laporan bukti')}<ArrowRight size={17} aria-hidden="true" /></Link>}
      </section>
      <DataModeBanner mode={dataMode} />
      <div className="investigation-views" role="group" aria-label={t('Tampilan pemeriksaan')}>
        <button type="button" aria-pressed={view === 'summary'} onClick={() => setView('summary')}>{t('Ringkasan')}</button>
        <button type="button" aria-pressed={view === 'flow'} onClick={() => setView('flow')}>{t('Alur agent')}</button>
      </div>
      {view === 'flow' && <AgentFlow state={state} connection={connection} />}
      {state.rawThesis ? (
        <details className="source-message">
          <summary>{t('Pesan asli dan klaim yang ditemukan')}</summary>
        <ThesisSplit rawThesis={state.rawThesis} claims={state.claims} settled={settled} />
        </details>
      ) : (
        !terminal && <p className="muted" aria-live="polite">{t('Membaca pesan dan mengenali klaimnya…')}</p>
      )}
      {state.status === 'AWAITING_CONFIRMATION' && <ConfirmCompany sessionId={id} />}
      {(state.error || startError) && <p className="notice" role="alert">{state.error || startError}</p>}
      {terminal && !state.reportId && <p className="notice" role="note">{t('Pemeriksaan berakhir tanpa laporan')} · <Link href="/">{t('Cek pesan lagi')}</Link></p>}
      {view === 'summary' && settled &&
        state.claims
          .filter((c) => c.verifiability !== 'NO')
          .map((c, index) => (
            <section key={c.id} className="sheet claim-panel" aria-labelledby={`h-${c.id}`}>
              <div className="claim-header">
                <div><span className="eyebrow">{t('Klaim')} {index + 1}</span><h2 id={`h-${c.id}`}>“{c.originalText}”</h2></div>
                <Status value={c.assessment} />
              </div>
              <div className="claim-overview"><span className="small muted">{c.coverage?.label ?? t('Bukti sedang dikumpulkan untuk klaim ini.')}</span><BudgetMeter claim={c} /></div>
              <details className="claim-details">
                <summary>{t('Lihat langkah pemeriksaan')} · {t('{count} langkah', { count: c.steps.length })}</summary>
              <div className="lanes">
                <div>
                  <div className="lane-title voice-thesis">{t('Klaim dalam pesan')}</div>
                  <p style={{ margin: 0 }}>{c.normalizedText}</p>
                  {c.coverage && <p className="small muted">{c.coverage.label}</p>}
                </div>
                <div>
                  <div className="lane-title">{t('Pemeriksaan yang dilakukan')}</div>
                  <ReasoningThread steps={c.steps} />
                </div>
                <div>
                  <div className="lane-title voice-counter">{t('Alasan tandingan')}</div>
                  {c.direction === 'bearish' ? (
                    <p className="muted small">{t('Klaim ini menyatakan kelemahan. Bukti kekuatan yang dapat menyanggahnya ditampilkan pada langkah pemeriksaan.')}</p>
                  ) : (
                    <CounterLane steps={c.steps} finished={c.assessment !== null} />
                  )}
                </div>
              </div>
              </details>
            </section>
          ))}
      {state.reportId && (
        <div className="sheet page-toolbar">
          <span>{t('Hasil dan bukti sudah tersedia.')}</span>
          <Link className="button primary" href={`/t/${id}/report`}>
            {t('Baca laporan bukti')}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      )}
    </main>
  );
}
