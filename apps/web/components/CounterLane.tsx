import type { StepEvent } from '@/lib/api';
import { formatValue, isHeadlineMetric, metricLabel } from '@/lib/format';

/** Hypotheses the agent has chosen to test, filled as their evidence arrives. */
export function CounterLane({ steps }: { steps: StepEvent[] }) {
  const tested = steps.filter((s) => s.phase === 'counterpoint' && s.action.startsWith('get_'));
  if (!tested.length) return <p className="muted small">The counter-case starts once the claim’s own checks are done.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
      {tested.map((s) => {
        const metric = s.evidence.find((e) => isHeadlineMetric(e.metric));
        return (
          <li key={s.id} className="sheet" style={{ padding: 16, boxShadow: 'inset 3px 0 0 var(--counter)' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{s.hypothesis}</p>
            {metric && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                {metricLabel(metric.metric)}: <strong>{formatValue(metric.value, metric.unit)}</strong>
                {metric.status !== 'VALID' && <span className="muted"> · {metric.note}</span>}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
