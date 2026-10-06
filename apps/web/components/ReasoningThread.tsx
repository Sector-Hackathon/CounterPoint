'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { StepEvent } from '@/lib/api';
import { isHeadlineMetric, metricLabel, stepHeadline } from '@/lib/format';
import { isVisibleStep } from '@/lib/session-logic';
import { CountUp } from './CountUp';

/**
 * The agent's execution trace. Each step states the question it is testing and the rule that
 * will decide it *before* the data arrives, then the result, what it did to the claim, and any
 * further question it opened. All of it comes from the versioned evidence contract — never from
 * model reasoning, and never with an internal check id on screen.
 */
export function ReasoningThread({ steps }: { steps: StepEvent[] }) {
  const { language, t } = useLanguage();
  const reduce = useReducedMotion();
  const visible = steps.filter(isVisibleStep);
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
              {s.question ?? stepHeadline(s, language)}
              {s.resultStatus === 'NO_DATA' && <span className="muted small"> · {t('data tidak tersedia')}</span>}
              {s.resultStatus === 'ERROR' && <span className="muted small"> · {t('terjadi kendala')}</span>}
            </div>

            {/* Why this question is being asked now. Omitted where it would repeat the headline. */}
            {s.question && (
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {s.purpose ? `${s.purpose} · ${stepHeadline(s, language)}` : stepHeadline(s, language)}
              </p>
            )}
            <p style={{ margin: '4px 0 6px' }}>{bodyText(s)}</p>

            {/* The decision rule, stated before the result. */}
            {s.rule && (
              <p className="rule small tabular" style={{ margin: '0 0 6px' }}>
                {s.rule}
              </p>
            )}

            {/* The measured result. */}
            {s.evidence.filter((e) => isHeadlineMetric(e.metric)).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {s.evidence
                  .filter((e) => isHeadlineMetric(e.metric))
                  .map((e) => (
                    <span key={e.id} className="chip" data-status={e.status}>
                      {metricLabel(e.metric, language)} <strong><CountUp value={e.value} unit={e.unit} /></strong>
                      {e.economicPeriod && (
                        <span className="muted small">
                          {e.economicPeriod}
                          {e.comparisonPeriod ? ` vs ${e.comparisonPeriod}` : ''}
                        </span>
                      )}
                      {e.status !== 'VALID' && <span className="muted small">{e.note ?? t('tidak tersedia')}</span>}
                    </span>
                  ))}
              </div>
            )}

            {/* What it did to the claim. */}
            {s.effect && (
              <p className="effect" data-outcome={s.outcome ?? undefined} style={{ margin: '6px 0 0' }}>
                {capitalize(s.effect)}
              </p>
            )}

            {/* Which further investigation this result opened. */}
            {s.opened.length > 0 && (
              <div style={{ margin: '6px 0 0' }}>
                <ForkMark />
                <p className="small" style={{ margin: 0 }}>
                  {t('Membuka {count} pertanyaan lanjutan', { count: s.opened.length })}:{' '}
                  <span className="voice-counter">{s.opened.join(' ')}</span>
                </p>
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every stored reason is already written as prose, including the plan step's. */
const bodyText = (s: StepEvent): string => s.reason;
