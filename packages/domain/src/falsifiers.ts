import { assess, type CheckState, type EvidenceContract } from './contracts';
import type { ChangeCondition, EvidenceItem } from './models';
import type { Assessment, ClaimDirection, Verifiability } from './ontology';

/** The state a check would be in if the condition were met. */
function flipped(states: CheckState[], checkId: string, outcome: CheckState['outcome']): CheckState[] {
  return states.map((s) => (s.checkId === checkId ? { ...s, status: 'completed' as const, outcome } : s));
}

/**
 * Deterministic "what would change this verdict" (final-week spec F2, phase 4).
 *
 * For each check that does not currently help the claim, this states the contract threshold that
 * would flip it next to the current value, then **re-runs the assessment rule with that one change
 * applied**. `wouldBecome` is set only when the verdict actually changes, so a condition that
 * merely strengthens the evidence is never presented as one that would overturn the verdict.
 * Required evidence that is missing is listed too, since obtaining it can change the outcome.
 *
 * Nothing here is predicted or generated: thresholds come from the versioned contract and the
 * resulting verdict comes from the same `assess()` the report itself uses.
 */
export function whatWouldChange(
  contract: EvidenceContract,
  states: CheckState[],
  evidence: EvidenceItem[],
  direction: ClaimDirection = 'bullish',
  verifiability: Verifiability = 'YES',
): ChangeCondition[] {
  // Flip rules are written in the bullish frame; for a bearish claim they would read backwards.
  if (direction === 'bearish') return [];
  const byMetric = new Map<string, EvidenceItem>();
  for (const e of evidence) byMetric.set(e.metric, e);
  const current: Assessment = assess(contract, states, verifiability);

  const verdictIfFlipped = (checkId: string, outcome: CheckState['outcome']): Assessment | null => {
    const next = assess(contract, flipped(states, checkId, outcome), verifiability);
    return next === current ? null : next;
  };

  const out: ChangeCondition[] = [];
  for (const s of states) {
    const check = contract.checks.find((c) => c.id === s.checkId);
    if (!check) continue;

    // Required evidence that never arrived: obtaining it is itself a condition.
    if (s.kind === 'required' && s.status !== 'completed') {
      out.push({
        checkId: check.id,
        label: check.description,
        comparator: null,
        threshold: null,
        current: null,
        unit: null,
        period: null,
        evidenceId: null,
        effect: 'missing_evidence',
        wouldBecome: verdictIfFlipped(check.id, 'supports'),
      });
      continue;
    }

    if (s.status !== 'completed' || !check.flip) continue;
    const helps = s.kind === 'required' ? s.outcome === 'supports' : s.outcome !== 'weakens';
    if (helps) continue;
    const e = byMetric.get(check.flip.metric);
    if (!e || e.value === null) continue;

    // A required check helps by supporting; a countercheck helps by no longer weakening.
    const helpful = s.kind === 'required' ? ('supports' as const) : ('neutral' as const);
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
      wouldBecome: verdictIfFlipped(check.id, helpful),
    });
  }

  // Conditions that would actually move the verdict first.
  return out.sort((a, b) => Number(b.wouldBecome !== null) - Number(a.wouldBecome !== null));
}
