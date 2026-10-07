'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GitBranch, List } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, type EvidenceItem, type ReportView, type SessionView } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import type { ClaimState } from '@/lib/session-state';
import { ThesisSplit } from '@/components/ThesisSplit';
import { ConfirmCompany } from '@/components/ConfirmCompany';
import { Status } from '@/components/Status';
import { BudgetMeter } from '@/components/BudgetMeter';
import { ReasoningThread } from '@/components/ReasoningThread';
import { CounterLane } from '@/components/CounterLane';
import { DataModeBanner } from '@/components/DataModeBanner';
import { AgentFlow } from '@/components/AgentFlow';
import { VerdictCard } from '@/components/VerdictCard';
import { ReportSummary } from '@/components/ReportSummary';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { Composer } from '@/components/Composer';
import { coverageLabel } from '@/lib/display-copy';
import { isVisibleStep } from '@/lib/session-logic';

/**
 * One check, top to bottom: the thesis, then one card per claim. While the agent works each card
 * shows its live steps; when the report is ready the same cards fill with the verdict, the
 * evidence for and against, and what would change it. Evidence opens in a side drawer.
 */
export default function Check() {
  const { language, t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { state, connection } = useSessionEvents(id);
  const [graph, setGraph] = useState(false);
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
  const claimById = new Map(state.claims.map((c) => [c.id, c]));
  const checkable = state.claims.filter((c) => c.verifiability !== 'NO');
  const assessed = checkable.filter((c) => c.assessment !== null).length;
  const statusLabel = state.status === 'FAILED' ? 'Pemeriksaan terhenti'
    : state.status === 'PARTIAL' ? 'Pemeriksaan selesai sebagian'
    : report || state.status === 'COMPLETED' ? 'Pemeriksaan selesai'
    : state.status === 'AWAITING_CONFIRMATION' ? 'Konfirmasi saham terlebih dahulu'
    : state.status === 'INVESTIGATING' ? 'Memeriksa bukti dari dua sisi'
    : 'Membaca pesan dan mengenali klaim';

  return (
    <main id="main-content" className="check">
      <div className="check-column">
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
        {state.status === 'PARTIAL' && <p className="small muted" style={{ margin: 0 }}>{t('Sebagian pemeriksaan belum lengkap. Baca batasannya di laporan.')}</p>}

        <DataModeBanner mode={snapshot?.dataMode ?? null} />
        {state.status === 'AWAITING_CONFIRMATION' && <ConfirmCompany sessionId={id} />}
        {(state.error || startError) && <p className="notice" role="alert">{state.error || startError}</p>}
        {reportError && <p className="notice" role="alert">{reportError}</p>}
        {evidenceError && <p className="notice" role="alert">{t(evidenceError)}</p>}
        {terminal && !state.reportId && <p className="notice" role="note">{t('Pemeriksaan berakhir tanpa laporan')} · <Link href="/check">{t('Cek pesan lagi')}</Link></p>}

        {graph && <AgentFlow state={state} connection={connection} />}

        {report && (
          <ReportSummary report={report} quotes={quotes} evidence={evidence} evidenceReady={evidenceReady} dataMode={snapshot?.dataMode ?? null} partial={state.status === 'PARTIAL' || snapshot?.status === 'PARTIAL'} />
        )}

        <div className="claims">
          {report
            ? report.claims.map((c) => {
                const live = claimById.get(c.claimId);
                return (
                  <VerdictCard key={c.claimId} quote={quotes[c.claimId] ?? t('Klaim')} report={c} onOpen={onOpen}>
                    {live && <AgentSteps claim={live} terminal={terminal} reported />}
                  </VerdictCard>
                );
              })
            : state.claims.map((c, index) => (
                <section key={c.id} className="sheet claim-card" aria-labelledby={`h-${c.id}`}>
                  <header className="claim-card-head">
                    <div>
                      <span className="claim-index">{t('Klaim')} {index + 1}</span>
                      <h2 id={`h-${c.id}`}>“{c.originalText}”</h2>
                    </div>
                    <Status value={c.verifiability === 'NO' ? 'UNVERIFIABLE' : c.assessment} />
                  </header>
                  {c.verifiability === 'NO' ? (
                    <p className="small muted" style={{ margin: 0 }}>{c.scopeNote ? t(c.scopeNote) : t('Klaim ini tidak dapat diuji dengan data yang tersedia.')}</p>
                  ) : (
                    <>
                      <div className="claim-overview">
                        <span className="small muted">{c.coverage ? coverageLabel(c.coverage, language) : t('Bukti sedang dikumpulkan untuk klaim ini.')}</span>
                        <BudgetMeter claim={c} />
                      </div>
                      <AgentSteps claim={c} terminal={terminal} />
                    </>
                  )}
                </section>
              ))}
        </div>

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

/** "How the agent checked this": the claim's live steps, open while it runs, folded once reported. */
function AgentSteps({ claim, terminal, reported = false }: { claim: ClaimState; terminal: boolean; reported?: boolean }) {
  const { t } = useLanguage();
  const steps = claim.steps.filter(isVisibleStep).length;
  if (claim.verifiability === 'NO' || claim.steps.length === 0) return null;
  return (
    <details className="agent-steps" open={!reported && claim.assessment === null}>
      <summary>{t('Cara agent memeriksa klaim ini')} · {t('{count} langkah', { count: steps })}</summary>
      <div className="agent-steps-body">
        <ReasoningThread steps={claim.steps} terminal={terminal} />
        {!reported && claim.direction !== 'bearish' && (
          <div className="agent-steps-counter">
            <span className="lane-title voice-counter">{t('Alasan tandingan')}</span>
            <CounterLane steps={claim.steps} finished={claim.assessment !== null} />
          </div>
        )}
      </div>
    </details>
  );
}
