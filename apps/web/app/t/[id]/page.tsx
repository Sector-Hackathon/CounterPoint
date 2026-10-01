'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSessionEvents } from '@/lib/use-session-events';
import { ThesisSplit } from '@/components/ThesisSplit';
import { ConfirmCompany } from '@/components/ConfirmCompany';

export default function Investigation() {
  const { id } = useParams<{ id: string }>();
  const { state } = useSessionEvents(id);
  const [settled, setSettled] = useState(false);

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
      {state.rawThesis ? (
        <ThesisSplit rawThesis={state.rawThesis} claims={state.claims} settled={settled} />
      ) : (
        <p className="muted" aria-live="polite">Reading the thesis and finding the claims in it…</p>
      )}
      {state.status === 'AWAITING_CONFIRMATION' && <ConfirmCompany sessionId={id} />}
      {state.error && <p role="alert" style={{ color: 'var(--resolve)' }}>{state.error}</p>}
    </main>
  );
}
