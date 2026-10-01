'use client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type EvidenceItem, type ReportView } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import { VerdictCard } from '@/components/VerdictCard';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const { state } = useSessionEvents(id);
  const [report, setReport] = useState<ReportView | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [open, setOpen] = useState<EvidenceItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.reportId) return;
    api.getReport(id).then(setReport).catch((e: Error) => setError(e.message));
  }, [id, state.reportId]);

  useEffect(() => {
    if (!report) return;
    Promise.all(report.claims.map((c) => api.getEvidence(c.claimId).then((r) => r.items))).then((xs) => setEvidence(xs.flat()));
  }, [report]);

  const onOpen = useCallback((evidenceId: string) => setOpen(evidence.find((e) => e.id === evidenceId) ?? null), [evidence]);
  const closeDrawer = useCallback(() => setOpen(null), []);
  const quoteOf = (claimId: string) => state.claims.find((c) => c.id === claimId)?.originalText ?? '';

  return (
    <main className="page" style={{ display: 'grid', gap: 28 }}>
      <p><a href={`/t/${id}`}>Back to the investigation</a></p>
      {state.rawThesis && <blockquote style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.3rem', maxWidth: '50ch' }}>{state.rawThesis}</blockquote>}
      {error && <p role="alert">{error}</p>}
      {!report && !error && !state.reportId && ['FAILED', 'PARTIAL', 'COMPLETED'].includes(state.status) && (
        <p role="alert">
          The investigation ended without a report{state.error ? `: ${state.error}` : '.'} <a href="/">Check a thesis again</a>
        </p>
      )}
      {!report && !error && !['FAILED', 'PARTIAL', 'COMPLETED'].includes(state.status) && (
        <p className="muted" aria-live="polite">The report appears when the investigation finishes.</p>
      )}
      {report?.claims.map((c) => <VerdictCard key={c.claimId} quote={quoteOf(c.claimId)} report={c} onOpen={onOpen} />)}
      {report && <p className="small muted">{report.disclaimer}</p>}
      <EvidenceDrawer item={open} all={evidence} onClose={closeDrawer} />
    </main>
  );
}
