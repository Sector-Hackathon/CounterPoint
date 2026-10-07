'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GitBranch, List } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, type EvidenceItem, type ReportView, type SessionView } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import { ThesisSplit } from '@/components/ThesisSplit';
import { ConfirmCompany } from '@/components/ConfirmCompany';
import { Status } from '@/components/Status';
import { DataModeBanner } from '@/components/DataModeBanner';
import { AgentFlow } from '@/components/AgentFlow';
import { ReportSummary } from '@/components/ReportSummary';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { Composer } from '@/components/Composer';
import { ClaimAnalytics } from '@/components/ClaimAnalytics';

/**
 * One check: the thesis, then its claims as tabs. Each tab is an analytics view of one claim that
 * fills in live while the agent works and becomes the report when it finishes.
 */
export default function Check() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { state, connection } = useSessionEvents(id);
  const [graph, setGraph] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SessionView | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportView | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceReady, setEvidenceReady] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [open, setOpen] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    api.getSession(id).then(setSnapshot).catch(() => setSnapshot(null));
  }, [id]);

  // Start investigating as soon as claims are ready (the endpoint is idempotent).
  useEffect(() => {
    if (state.status === 'CLAIMS_EXTRACTED') api.investigate(id).catch((error: Error) => setStartError(error.message));
  }, [state.status, id]);

  useEffect(() => {
    if (!state.reportId) return;
    api.getReport(id).then(setReport).catch((e: Error) => setReportError(e.message));
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

  const terminal = ['COMPLETED', 'PARTIAL', 'FAILED'].includes(state.status);
  const rawThesis = state.rawThesis || snapshot?.rawThesis || null;
  const quotes = Object.fromEntries([...(snapshot?.claims ?? []), ...state.claims].map((c) => [c.id, c.originalText]));
  const checkable = state.claims.filter((c) => c.verifiability !== 'NO');
  const assessed = checkable.filter((c) => c.assessment !== null).length;
  const statusLabel = state.status === 'FAILED' ? 'Pemeriksaan terhenti'
    : state.status === 'PARTIAL' ? 'Pemeriksaan selesai sebagian'
    : report || state.status === 'COMPLETED' ? 'Pemeriksaan selesai'
    : state.status === 'AWAITING_CONFIRMATION' ? 'Konfirmasi saham terlebih dahulu'
    : state.status === 'INVESTIGATING' ? 'Memeriksa bukti dari dua sisi'
    : 'Membaca pesan dan mengenali klaim';

  // Follow the claim the agent is working on until the user picks one.
  const working = [...checkable].reverse().find((c) => c.assessment === null && c.steps.length > 0) ?? checkable.find((c) => c.assessment === null);
  const activeId = picked ?? (!terminal && working ? working.id : state.claims[0]?.id ?? null);
  const active = state.claims.find((c) => c.id === activeId) ?? null;
  const activeReport = report?.claims.find((c) => c.claimId === activeId) ?? null;

  return (
    <main id="main-content" className="check">
      <div className="check-column check-wide">
        {rawThesis ? (
          <section className="thesis-block" aria-label={t('Pesan yang diperiksa')}>
            <span className="thesis-label">{t('Pesan yang diperiksa')}</span>
            <ThesisSplit rawThesis={rawThesis} claims={state.claims} settled={false} />
          </section>
        ) : (
          !terminal && <p className="muted" aria-live="polite">{t('Membaca pesan dan mengenali klaimnya…')}</p>
        )}

        <div className="check-status" role="status">
          {!terminal && <span className="pulse" aria-hidden="true" />}
          <strong>{t(statusLabel)}</strong>
          {checkable.length > 0 && !report && <span className="muted">· {t('{completed} dari {total} klaim telah dinilai.', { completed: assessed, total: checkable.length })}</span>}
          {state.claims.length > 0 && (
            <button type="button" className="check-graph-toggle" aria-pressed={graph} onClick={() => setGraph((v) => !v)}>
              {graph ? <List size={15} aria-hidden="true" /> : <GitBranch size={15} aria-hidden="true" />}
              {t(graph ? 'Tutup alur agent' : 'Lihat alur agent')}
            </button>
          )}
        </div>

        <DataModeBanner mode={snapshot?.dataMode ?? null} />
        {state.status === 'AWAITING_CONFIRMATION' && <ConfirmCompany sessionId={id} />}
        {(state.error || startError) && <p className="notice" role="alert">{state.error || startError}</p>}
        {reportError && <p className="notice" role="alert">{reportError}</p>}
        {evidenceError && <p className="notice" role="alert">{t(evidenceError)}</p>}
        {terminal && !state.reportId && <p className="notice" role="note">{t('Pemeriksaan berakhir tanpa laporan')} · <Link href="/check">{t('Cek pesan lagi')}</Link></p>}

        {graph && <AgentFlow state={state} connection={connection} />}

        {state.claims.length > 0 && (
          <div className="claim-tabs" role="tablist" aria-label={t('Klaim dalam pesan')}>
            {state.claims.map((c, i) => {
              const verdict = report?.claims.find((r) => r.claimId === c.id)?.assessment ?? (c.verifiability === 'NO' ? 'UNVERIFIABLE' : c.assessment);
              const running = !terminal && c.verifiability !== 'NO' && c.assessment === null && c.steps.length > 0;
              return (
                <button key={c.id} type="button" role="tab" id={`tab-${c.id}`} aria-selected={c.id === activeId} aria-controls="claim-panel"
                  className="claim-tab" onClick={() => setPicked(c.id)}>
                  <span className="claim-tab-n tabular">{i + 1}</span>
                  <span className="claim-tab-text">{c.originalText}</span>
                  {running ? <span className="pulse" aria-label={t('Sedang diperiksa')} /> : <Status value={verdict} />}
                </button>
              );
            })}
          </div>
        )}

        {active && (
          <div id="claim-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`}>
            <ClaimAnalytics claim={active} report={activeReport} terminal={terminal} onOpen={onOpen} />
          </div>
        )}

        {report && (
          <details className="an-summary">
            <summary>{t('Ringkasan semua klaim & bagikan')}</summary>
            <ReportSummary report={report} quotes={quotes} evidence={evidence} evidenceReady={evidenceReady} dataMode={snapshot?.dataMode ?? null} partial={state.status === 'PARTIAL' || snapshot?.status === 'PARTIAL'} />
          </details>
        )}
        {report && <p className="small muted">{t(report.disclaimer)}</p>}
      </div>

      {terminal && (
        <div className="check-foot">
          <Composer compact />
        </div>
      )}
      <EvidenceDrawer item={open} all={evidence} onClose={closeDrawer} />
    </main>
  );
}
