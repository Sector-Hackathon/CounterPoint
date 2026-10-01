'use client';
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

export default function Investigation() {
  const { id } = useParams<{ id: string }>();
  const { state } = useSessionEvents(id);
  const [settled, setSettled] = useState(false);
  const [dataMode, setDataMode] = useState<'live' | 'fixture' | null>(null);

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
    if (state.status === 'CLAIMS_EXTRACTED') void api.investigate(id);
  }, [state.status, id]);

  return (
    <main className="page">
      {dataMode === 'fixture' && (
        <p className="small" role="note" style={{ background: 'var(--hatch), var(--paper-raised)', padding: '8px 12px', borderRadius: 'var(--r-chip)', marginTop: 0 }}>
          Synthetic sample data, not live Sectors data. Numbers are illustrative only.
        </p>
      )}
      {state.rawThesis ? (
        <ThesisSplit rawThesis={state.rawThesis} claims={state.claims} settled={settled} />
      ) : (
        <p className="muted" aria-live="polite">Reading the thesis and finding the claims in it…</p>
      )}
      {state.status === 'AWAITING_CONFIRMATION' && <ConfirmCompany sessionId={id} />}
      {state.error && <p role="alert" style={{ color: 'var(--resolve)' }}>{state.error}</p>}
      {settled &&
        state.claims
          .filter((c) => c.verifiability !== 'NO')
          .map((c) => (
            <section key={c.id} style={{ marginTop: 48 }} aria-labelledby={`h-${c.id}`}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 16 }}>
                <h2 id={`h-${c.id}`}>“{c.originalText}”</h2>
                <Status value={c.assessment} />
                <span style={{ marginLeft: 'auto' }}>
                  <BudgetMeter claim={c} />
                </span>
              </div>
              <div className="lanes">
                <div>
                  <div className="lane-title voice-thesis">The thesis says</div>
                  <p style={{ margin: 0 }}>{c.normalizedText}</p>
                  {c.coverage && <p className="small muted">{c.coverage.label}</p>}
                </div>
                <div>
                  <div className="lane-title">What the agent did</div>
                  <ReasoningThread steps={c.steps} />
                </div>
                <div>
                  <div className="lane-title voice-counter">The counterpoint</div>
                  {c.direction === 'bearish' ? (
                    <p className="muted small">This claim is bearish, so the counter-case is any evidence of strength, shown in the thread.</p>
                  ) : (
                    <CounterLane steps={c.steps} />
                  )}
                </div>
              </div>
            </section>
          ))}
      {state.reportId && (
        <p style={{ marginTop: 48 }}>
          <a className="button" href={`/t/${id}/report`}>
            Read the evidence report
          </a>
        </p>
      )}
    </main>
  );
}
