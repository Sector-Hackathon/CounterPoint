'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type EntityView, type SessionView } from '@/lib/api';
import { AssessmentBadge } from '@/components/AssessmentBadge';

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

const STATUS_TEXT: Record<string, string> = {
  CREATED: 'Reading the thesis and resolving companies…',
  AWAITING_CONFIRMATION: 'Please confirm which company the thesis refers to.',
  CLAIMS_EXTRACTED: 'Claims extracted. Ready to investigate.',
  INVESTIGATING: 'Investigating evidence…',
  COMPLETED: 'Investigation complete.',
  PARTIAL: 'Investigation finished with gaps (budget or data limits).',
  FAILED: 'Investigation failed.',
};

export default function Investigation() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await api.getSession(id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session || TERMINAL.has(session.status) || session.status === 'AWAITING_CONFIRMATION') return;
    const t = setInterval(load, 1000);
    return () => clearInterval(t);
  }, [session, load]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!session) return <p className="muted">Loading…</p>;

  const done = session.status === 'COMPLETED' || session.status === 'PARTIAL';

  return (
    <>
      <div className="page-head">
        <div>
          <p style={{ margin: '0 0 6px' }}><Link href="/app/verify">← New check</Link></p>
          <h1>Investigation</h1>
        </div>
        <div className="row">
          {session.status === 'CLAIMS_EXTRACTED' && (
            <button onClick={async () => { await api.investigate(id); void load(); }}>Investigate evidence</button>
          )}
          {done && <Link className="button" href={`/app/theses/${id}/report`}>View evidence report</Link>}
        </div>
      </div>

      <blockquote className="card" style={{ margin: 0 }}>“{session.rawThesis}”</blockquote>

      <div className="row" style={{ marginTop: 12 }} aria-live="polite">
        <span className="tag">{session.status.replace('_', ' ')}</span>
        <span className="muted">{STATUS_TEXT[session.status] ?? session.status}</span>
        {session.dataMode === 'fixture' && <span className="tag">Synthetic fixture data, not live Sectors</span>}
      </div>
      {session.error && <p className="error">{session.error}</p>}

      <h2>Detected companies</h2>
      {session.entities.length === 0 && <p className="muted">No company detected yet.</p>}
      <div className="stack">
        {session.entities.map((e) => (
          <EntityRow key={e.id} sessionId={id} entity={e} onConfirmed={setSession} />
        ))}
      </div>

      <h2>Claims</h2>
      <div className="stack">
        {session.claims.map((c) => (
          <section key={c.id} className="card">
            <div className="row">
              <AssessmentBadge value={c.assessment} />
              <span className="tag">{c.claimType.replace(/_/g, ' ')}</span>
              <span className="tag">Verifiable: {c.verifiability}</span>
              {c.ticker && <span className="tag">{c.ticker}</span>}
            </div>
            <p style={{ margin: '12px 0 4px' }}><strong>“{c.originalText}”</strong></p>
            <p className="muted" style={{ margin: 0 }}>{c.normalizedText}</p>
            {c.scopeNote && <p className="muted">{c.scopeNote}</p>}

            {c.trace.length > 0 && (
              <details open={!done} style={{ marginTop: 10 }}>
                <summary>Agent trace ({c.trace.filter((t) => t.action.startsWith('get_')).length} tool calls)</summary>
                <ol className="trace">
                  {c.trace.map((t) => (
                    <li key={t.id} data-kind={t.action.startsWith('get_') ? 'tool' : t.action === 'REPLAN' ? 'replan' : 'step'}>
                      <span className="action">{t.action}</span>{' '}
                      {t.resultStatus !== 'OK' && <span className="tag">{t.resultStatus}</span>} {t.reason}
                      {t.stopReason && <> <span className="tag">stop: {t.stopReason}</span></>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        ))}
      </div>
      {session.claims.length > 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>Extracted by {session.claims[0]!.extractor}.</p>
      )}
    </>
  );
}

function EntityRow({ sessionId, entity, onConfirmed }: { sessionId: string; entity: EntityView; onConfirmed: (s: SessionView) => void }) {
  const [choice, setChoice] = useState(entity.candidates[0]?.ticker ?? '');
  if (entity.resolutionStatus !== 'AMBIGUOUS') {
    return (
      <div className="row">
        <span className="tag">{entity.resolutionStatus}</span>
        <span>
          “{entity.mention}” → {entity.ticker ? <strong>{entity.ticker}</strong> : 'unknown'} {entity.canonicalName}
          {entity.isPrimary && ' (primary)'}
        </span>
      </div>
    );
  }
  return (
    <div className="card">
      <label htmlFor={`e-${entity.id}`}>“{entity.mention}” matches several companies. Which one?</label>
      <div className="row" style={{ marginTop: 8 }}>
        <select id={`e-${entity.id}`} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {entity.candidates.map((c) => (
            <option key={c.ticker} value={c.ticker}>{c.ticker} — {c.name}</option>
          ))}
        </select>
        <button onClick={async () => onConfirmed(await api.confirmEntity(sessionId, entity.id, choice))}>Confirm</button>
      </div>
    </div>
  );
}
