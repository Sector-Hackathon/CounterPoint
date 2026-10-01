import type { CheckState, EvidenceContract } from './contracts';
import type { ChangeCondition, EvidenceItem } from './models';
import type { ClaimDirection } from './ontology';

/**
 * Deterministic "what would change this verdict" (final-week spec F2). For each completed
 * check that does not currently help the claim, states the contract threshold that would
 * flip it, next to the current value. No prediction: thresholds come from the versioned contract.
 */
export function whatWouldChange(
  contract: EvidenceContract,
  states: CheckState[],
  evidence: EvidenceItem[],
  direction: ClaimDirection = 'bullish',
): ChangeCondition[] {
  // Flip rules are written in the bullish frame; for a bearish claim they would read backwards.
  if (direction === 'bearish') return [];
  const byMetric = new Map<string, EvidenceItem>();
  for (const e of evidence) byMetric.set(e.metric, e);
  const out: ChangeCondition[] = [];
  for (const s of states) {
    if (s.status !== 'completed') continue;
    const check = contract.checks.find((c) => c.id === s.checkId);
    if (!check?.flip) continue;
    const helps = s.kind === 'required' ? s.outcome === 'supports' : s.outcome !== 'weakens';
    if (helps) continue;
    const e = byMetric.get(check.flip.metric);
    if (!e || e.value === null) continue;
    out.push({
      checkId: check.id,
      label: check.flip.label,
      comparator: check.flip.comparator,
      threshold: check.flip.threshold(contract.thresholds),
      current: e.value,
      unit: check.flip.unit,
      period: e.economicPeriod ?? e.observationDate,
      evidenceId: e.id,
      effect: s.kind === 'required' ? 'would_support' : 'would_stop_weakening',
    });
  }
  return out;
}
