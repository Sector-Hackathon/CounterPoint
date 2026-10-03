import { describe, expect, it } from 'vitest';
import {
  contractForClaimType,
  describeTrigger,
  evaluateChecks,
  firedTriggers,
  getContract,
  openChecks,
  relativeValuationV2,
  relativeValuationV3,
  type CheckState,
} from '../src/index';

const DISCOUNT_QUESTIONS = ['roe_vs_peers', 'own_history', 'price_drawdown'];

/** Resolved state for one check, enough for openChecks/firedTriggers. */
const state = (checkId: string, over: Partial<CheckState> = {}): CheckState => ({
  checkId,
  kind: 'required',
  status: 'completed',
  outcome: 'neutral',
  evidenceIds: [],
  note: null,
  ...over,
});

/** Every check resolved except the discount questions, which stay pending. */
function statesWith(peerBaseline: CheckState['outcome']): CheckState[] {
  return relativeValuationV3.checks.map((c) =>
    DISCOUNT_QUESTIONS.includes(c.id)
      ? state(c.id, { kind: c.kind, status: 'pending', outcome: null })
      : state(c.id, { kind: c.kind, outcome: c.id === 'peer_baseline' ? peerBaseline : 'neutral' }),
  );
}

describe('relative-valuation-v3', () => {
  it('is the current contract for relative valuation and stays resolvable by id', () => {
    expect(contractForClaimType('RELATIVE_VALUATION')?.id).toBe('relative-valuation-v3');
    expect(getContract('relative-valuation-v3').id).toBe('relative-valuation-v3');
    // Earlier versions must keep resolving so stored reports still render.
    expect(getContract('relative-valuation-v2').id).toBe('relative-valuation-v2');
    expect(getContract('relative-valuation-v1').id).toBe('relative-valuation-v1');
  });

  it('changes which questions are asked, not where any threshold sits', () => {
    expect(relativeValuationV3.thresholds).toEqual(relativeValuationV2.thresholds);
    expect(relativeValuationV3.minRequiredCompleted).toBe(relativeValuationV2.minRequiredCompleted);
    expect(relativeValuationV3.checks.map((c) => c.id)).toEqual(relativeValuationV2.checks.map((c) => c.id));
    for (const c of relativeValuationV3.checks) {
      const v2 = relativeValuationV2.checks.find((x) => x.id === c.id)!;
      expect(c.evaluate).toBe(v2.evaluate);
      expect(c.flip?.threshold).toBe(v2.flip?.threshold);
    }
  });

  it('gates only the discount questions, on the peer baseline supporting the claim', () => {
    for (const c of relativeValuationV3.checks) {
      const expected = DISCOUNT_QUESTIONS.includes(c.id)
        ? [{ check: 'peer_baseline', outcome: 'supports' }]
        : undefined;
      expect(c.triggeredBy, c.id).toEqual(expected);
    }
    // v2 asked them unconditionally; that is the behaviour this version replaces.
    for (const id of DISCOUNT_QUESTIONS) {
      expect(relativeValuationV2.checks.find((c) => c.id === id)!.triggeredBy).toBeUndefined();
    }
  });

  it('asks why the discount exists only when there is a discount', () => {
    const open = (outcome: CheckState['outcome']) =>
      openChecks(relativeValuationV3, statesWith(outcome)).map((c) => c.id);
    expect(open('supports')).toEqual(DISCOUNT_QUESTIONS);
    expect(open('weakens')).toEqual([]);
    expect(open('neutral')).toEqual([]);
  });

  it('names the trigger that opened a question, for the trace', () => {
    const check = relativeValuationV3.checks.find((c) => c.id === 'roe_vs_peers')!;
    expect(firedTriggers(check, statesWith('supports'))).toEqual(['peer_baseline (supports)']);
    expect(firedTriggers(check, statesWith('weakens'))).toEqual([]);
    expect(describeTrigger('earnings_growth')).toBe('earnings_growth (weakens)');
  });

  it('keeps a bare check id meaning "weakens", so v2 growth triggers still fire', () => {
    const growth = getContract('absolute-growth-v2');
    const margin = growth.checks.find((c) => c.id === 'margin_deterioration')!;
    expect(margin.triggeredBy).toEqual(['revenue_earnings_divergence', 'earnings_growth']);
    const resolved = growth.checks.map((c) =>
      c.id === 'margin_deterioration'
        ? state(c.id, { kind: c.kind, status: 'pending', outcome: null })
        : state(c.id, { kind: c.kind, outcome: c.id === 'earnings_growth' ? 'weakens' : 'neutral' }),
    );
    expect(openChecks(growth, resolved).map((c) => c.id)).toContain('margin_deterioration');
    expect(firedTriggers(margin, resolved)).toEqual(['earnings_growth (weakens)']);
  });

  it('evaluates identically to v2 for the same evidence', () => {
    const evidence = [
      { metric: 'target_pe', value: 9.2 },
      { metric: 'peer_count', value: 5 },
      { metric: 'pe_vs_peer_median_pct', value: -24 },
    ].map((e, i) => ({
      id: `e${i}`, claimId: 'c', checkId: 'x', ticker: 'BBRI', unit: 'ratio' as const,
      economicPeriod: null, comparisonPeriod: null, observationDate: null, retrievalTime: 'now',
      sourceLocator: 'fixture:x', derivedFrom: [], calculationVersion: null, status: 'VALID' as const,
      note: null, ...e,
    }));
    const pick = (s: CheckState[]) => s.map((x) => [x.checkId, x.status, x.outcome]);
    expect(pick(evaluateChecks(relativeValuationV3, evidence))).toEqual(
      pick(evaluateChecks(relativeValuationV2, evidence)),
    );
  });
});
