'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ClaimReport, type EvidenceItem, type ReportView, type SessionView, type Statement } from '@/lib/api';
import { AssessmentBadge } from '@/components/AssessmentBadge';

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportView | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getReport(id), api.getSession(id)])
      .then(([r, s]) => {
        setReport(r);
        setSession(s);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) return <main><p className="error" role="alert">{error}</p></main>;
  if (!report || !session) return <main><p className="muted">Loading report…</p></main>;

  const claimText = new Map(session.claims.map((c) => [c.id, c]));

  return (
    <main>
      <p><Link href={`/theses/${id}`}>← Investigation</Link></p>
      <h1>Evidence report</h1>
      <blockquote className="card" style={{ margin: 0 }}>“{session.rawThesis}”</blockquote>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="tag">Validation: {report.validationStatus}</span>
        {session.dataMode === 'fixture' && <span className="tag">Synthetic fixture data — not live Sectors</span>}
      </div>
      {report.validationStatus === 'REPAIRED' && (
        <p className="muted">Some statements were removed because a number could not be traced to stored evidence.</p>
      )}

      {report.claims.map((c) => (
        <ClaimSection key={c.claimId} report={c} claim={claimText.get(c.claimId)} />
      ))}

      <p className="notice">{report.disclaimer}</p>
    </main>
  );
}

function ClaimSection({ report, claim }: { report: ClaimReport; claim: SessionView['claims'][number] | undefined }) {
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  return (
    <section className="card">
      <div className="row">
        <AssessmentBadge value={report.assessment} />
        <span className="tag">Coverage: {report.coverage.label}</span>
        {report.stopReason && <span className="tag">Stop: {report.stopReason}</span>}
      </div>
      {claim && (
        <>
          <p style={{ margin: '10px 0 2px' }}><strong>“{claim.originalText}”</strong></p>
          <p className="muted" style={{ margin: 0 }}>{claim.normalizedText}</p>
        </>
      )}

      <Statements title="Supports" items={report.supports} />
      <Statements title="Weakens" items={report.weakens} />
      <Statements title="Context" items={report.context} />
      {report.missing.length > 0 && (
        <>
          <h3>Missing evidence</h3>
          <ul className="statements">{report.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </>
      )}
      {report.interpretation && (
        <>
          <h3>Qualified interpretation</h3>
          <p>{report.interpretation.text}</p>
        </>
      )}
      {report.peerSet && (
        <>
          <h3>Peer set ({report.peerSet.policyVersion}, as of {report.peerSet.period})</h3>
          <p>Included ({report.peerSet.included.length}, minimum {report.peerSet.minPeers}): {report.peerSet.included.join(', ') || 'none'}</p>
          {report.peerSet.excluded.length > 0 && (
            <ul className="statements">
              {report.peerSet.excluded.map((e) => <li key={e.ticker}>{e.ticker}: {e.reason}</li>)}
            </ul>
          )}
        </>
      )}

      <details onToggle={async (e) => {
        if ((e.target as HTMLDetailsElement).open && !evidence) setEvidence((await api.getEvidence(report.claimId)).items);
      }}>
        <summary>Evidence provenance</summary>
        {!evidence ? <p className="muted">Loading…</p> : evidence.length === 0 ? <p className="muted">No evidence collected.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Metric</th><th>Value</th><th>Period</th><th>Status</th><th>Source</th><th>Id</th></tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id}>
                    <td>{e.metric}</td>
                    <td>{e.value ?? '—'} {e.unit}</td>
                    <td>{e.economicPeriod ?? e.observationDate ?? '—'}{e.comparisonPeriod ? ` vs ${e.comparisonPeriod}` : ''}</td>
                    <td>{e.status}{e.note ? ` — ${e.note}` : ''}</td>
                    <td><code>{e.sourceLocator}</code></td>
                    <td><code>{e.id.slice(0, 8)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}

function Statements({ title, items }: { title: string; items: Statement[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul className="statements">
        {items.map((s) => (
          <li key={s.text}>
            {s.text} <span className="muted">[{s.evidenceIds.map((i) => i.slice(0, 8)).join(', ')}]</span>
          </li>
        ))}
      </ul>
    </>
  );
}
