'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { StepEvent } from '@/lib/api';
import { isHeadlineMetric, metricLabel, stepHeadline } from '@/lib/format';
import { CountUp } from './CountUp';

const PREDICT: Record<string, string> = { supports: 'support the claim', weakens: 'weaken the claim', neutral: 'be inconclusive' };

export function ReasoningThread({ steps }: { steps: StepEvent[] }) {
  const reduce = useReducedMotion();
  const visible = steps.filter((s) => s.action !== 'EVALUATE' || s.resultStatus !== 'OK');
  return (
    <ol className="thread" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {visible.map((s) => (
          <motion.li
            key={s.id}
            data-phase={s.phase ?? undefined}
            data-kind={s.action === 'REPLAN' ? 'replan' : undefined}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ fontWeight: 600 }}>
              {s.phase === 'counterpoint' ? <span className="voice-counter">Testing the counter-case</span> : stepHeadline(s)}
              {s.resultStatus !== 'OK' && <span className="muted small"> · {s.resultStatus === 'NO_DATA' ? 'no data' : s.resultStatus.toLowerCase()}</span>}
            </div>
            <p style={{ margin: '2px 0 6px' }}>{s.phase === 'counterpoint' && s.hypothesis ? s.hypothesis : s.reason}</p>
            {s.expectation && (
              <p className="prediction" style={{ margin: '0 0 6px' }}>
                Expected this to {PREDICT[s.expectation]}.{' '}
                {s.expectationHeld !== null && (
                  <span className="held" data-held={String(s.expectationHeld)}>{s.expectationHeld ? 'It did.' : 'It didn’t.'}</span>
                )}
              </p>
            )}
            {s.action === 'REPLAN' && <ForkMark />}
            {s.evidence.filter((e) => isHeadlineMetric(e.metric)).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {s.evidence.filter((e) => isHeadlineMetric(e.metric)).map((e) => (
                  <span key={e.id} className="chip" data-status={e.status}>
                    {metricLabel(e.metric)} <strong><CountUp value={e.value} unit={e.unit} /></strong>
                    {e.economicPeriod && <span className="muted small">{e.economicPeriod}{e.comparisonPeriod ? ` vs ${e.comparisonPeriod}` : ''}</span>}
                    {e.status !== 'VALID' && <span className="muted small">{e.note ?? 'unavailable'}</span>}
                  </span>
                ))}
              </div>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** The fork: a branch drawn from the thread toward the counter lane when the agent changes course. */
function ForkMark() {
  const reduce = useReducedMotion();
  return (
    <svg width="120" height="28" viewBox="0 0 120 28" aria-hidden="true" style={{ display: 'block', margin: '-4px 0 4px -20px' }}>
      <motion.path
        d="M2 2 C 40 2, 60 26, 118 26"
        fill="none"
        stroke="var(--counter)"
        strokeWidth="2"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
