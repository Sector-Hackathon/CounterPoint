import type { StepEvent } from '@/lib/api';
import { formatValue, isHeadlineMetric, metricLabel } from '@/lib/format';

const VERDICT: Record<string, string> = {
  weakens: 'Yes, the data shows this.',
  neutral: 'No, the data doesn’t show this.',
  supports: 'No, the data doesn’t show this.',
};

/** Hypotheses the agent has chosen to test, filled as their evidence arrives. */
export function CounterLane({ steps }: { steps: StepEvent[] }) {
  const tested = steps.filter((s) => s.phase === 'counterpoint' && s.action.startsWith('get_'));
  if (!tested.length) return <p className="muted small">The counter-case starts once the claim’s own checks are done.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
      {tested.map((s) => {
        // The check's own derived metric is the last headline item it produced.
        const metric = [...s.evidence].reverse().find((e) => isHeadlineMetric(e.metric));
        const confirmed = s.outcome === 'weakens';
        return (
          <li
            key={s.id}
            className="sheet"
            style={{ padding: 16, boxShadow: `inset 3px 0 0 ${confirmed ? 'var(--counter)' : 'var(--rule)'}` }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>{s.hypothesis}</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              {s.outcome ? (
                <strong className={confirmed ? 'voice-counter' : undefined}>{VERDICT[s.outcome]}</strong>
              ) : (
                <span className="muted">Couldn’t test this with the available data.</span>
              )}
            </p>
            {metric && (
              <p className="small muted tabular" style={{ margin: '4px 0 0' }}>
                {metricLabel(metric.metric)}: {formatValue(metric.value, metric.unit)}
                {metric.status !== 'VALID' && metric.note ? ` · ${metric.note}` : ''}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
