'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { ClaimReport, Statement } from '@/lib/api';
import { ChangeConditions } from './ChangeConditions';
import { Status } from './Status';

function Statements({ items, onOpen }: { items: Statement[]; onOpen: (id: string) => void }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
      {items.map((s, i) => (
        <li key={i}>
          {s.text}{' '}
          {s.evidenceIds[0] && <button className="quiet small" style={{ padding: '2px 8px' }} onClick={() => onOpen(s.evidenceIds[s.evidenceIds.length - 1]!)}>Source</button>}
        </li>
      ))}
    </ul>
  );
}

/** The report's moment: thesis and counterpoint lanes slide together around the verdict. */
export function VerdictCard({ quote, report, onOpen }: { quote: string; report: ClaimReport; onOpen: (evidenceId: string) => void }) {
  const reduce = useReducedMotion();
  const counter = report.counterpoint?.hypotheses ?? [];
  const lane = (from: number) => (reduce ? {} : { initial: { x: from, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } });
  return (
    <article className="sheet" style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2>“{quote}”</h2>
        <Status value={report.assessment} />
        <span className="small muted" style={{ marginLeft: 'auto' }}>{report.coverage.label}</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
        <motion.section {...lane(-24)}>
          <div className="lane-title voice-thesis">For the thesis</div>
          {report.supports.length ? <Statements items={report.supports} onOpen={onOpen} /> : <p className="muted">Nothing in the data supports it yet.</p>}
          {report.context.length > 0 && (<><div className="lane-title" style={{ marginTop: 16 }}>Context</div><Statements items={report.context} onOpen={onOpen} /></>)}
        </motion.section>
        <motion.section {...lane(24)}>
          <div className="lane-title voice-counter">The counterpoint</div>
          {report.weakens.length > 0 && <Statements items={report.weakens} onOpen={onOpen} />}
          {counter.length > 0 && (
            <ul style={{ margin: report.weakens.length ? '12px 0 0' : 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
              {counter.map((h) => (
                <li key={h.checkId}>
                  <strong>{h.hypothesis}</strong>{' '}
                  <span className="small">{h.status === 'confirmed' ? 'Yes, the data shows this.' : h.status === 'refuted' ? 'No, the data doesn’t show this.' : h.status === 'untestable' ? `Couldn’t test: ${h.note ?? 'data unavailable'}.` : 'Not tested within budget.'}</span>
                  {h.statement && <div className="small muted">{h.statement.text}</div>}
                </li>
              ))}
            </ul>
          )}
          {!report.weakens.length && !counter.length && <p className="muted">No counter-evidence found within the checks run.</p>}
        </motion.section>
      </div>
      <ChangeConditions items={report.changeConditions} onOpen={onOpen} />
      {(report.missing.length > 0 || (report.counterpoint?.openQuestions.length ?? 0) > 0) && (
        <div style={{ background: 'var(--hatch), var(--paper)', borderRadius: 'var(--r-chip)', padding: 16 }}>
          <div className="lane-title">What the data can’t tell you</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {report.missing.map((m, i) => <li key={`m${i}`}>{m}</li>)}
            {report.counterpoint?.openQuestions.map((q, i) => <li key={`q${i}`}>{q}</li>)}
          </ul>
        </div>
      )}
      {report.interpretation && <p style={{ margin: 0 }}>{report.interpretation.text}</p>}
      {report.peerSet && (
        <details>
          <summary>Peer set ({report.peerSet.included.length} companies, {report.peerSet.period})</summary>
          <p className="small">Included: {report.peerSet.included.join(', ')}</p>
          <ul className="small">{report.peerSet.excluded.map((e) => <li key={e.ticker}>{e.ticker}: {e.reason}</li>)}</ul>
        </details>
      )}
    </article>
  );
}
