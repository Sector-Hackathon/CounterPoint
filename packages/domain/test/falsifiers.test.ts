import { describe, expect, it } from 'vitest';
import { absoluteGrowthV2, assess, evaluateChecks, whatWouldChange, type EvidenceItem } from '../src';

const ev = (metric: string, value: number): EvidenceItem => ({
  id: `${metric}-id`, claimId: 'c', checkId: 'x', metric, ticker: 'BBRI', value, unit: 'percent',
  economicPeriod: '2026Q2', comparisonPeriod: '2025Q2', observationDate: null, retrievalTime: 't',
  sourceLocator: 'fixture:x', derivedFrom: [], calculationVersion: 'calc-v1', status: 'VALID', note: null,
});

const run = (evidence: EvidenceItem[]) => {
  const states = evaluateChecks(absoluteGrowthV2, evidence);
  return { states, out: whatWouldChange(absoluteGrowthV2, states, evidence) };
};

describe('whatWouldChange', () => {
  it('names the threshold a neutral required check would need', () => {
    const evidence = [ev('revenue_yoy_pct', 8.4), ev('earnings_yoy_pct', 22.3), ev('annual_earnings_yoy_pct', 12)];
    const { states, out } = run(evidence);
    // Two required checks already support and nothing weakens, so the claim is already supported.
    expect(assess(absoluteGrowthV2, states, 'YES')).toBe('SUPPORTED');
    expect(out).toContainEqual({
      checkId: 'revenue_growth', label: 'Latest-quarter revenue growth YoY', comparator: 'at_least', threshold: 10,
      current: 8.4, unit: 'percent', period: '2026Q2', evidenceId: 'revenue_yoy_pct-id', effect: 'would_support',
      // Reaching 10% would add support but cannot improve on the verdict already reached.
      wouldBecome: null,
    });
  });

  it('says what would stop a weakening countercheck from weakening', () => {
    const evidence = [ev('revenue_yoy_pct', 12), ev('earnings_yoy_pct', -5), ev('net_margin_change_pp', -3.1)];
    expect(run(evidence).out.find((c) => c.checkId === 'margin_deterioration')).toMatchObject({
      comparator: 'above',
      threshold: -2,
      effect: 'would_stop_weakening',
    });
  });

  it('omits checks that already support or have no flip rule', () => {
    const evidence = [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', 15)];
    const ids = run(evidence).out.map((c) => c.checkId);
    expect(ids).not.toContain('revenue_growth');
    expect(ids).not.toContain('revenue_earnings_divergence');
  });

  describe('verdict simulation (phase 4)', () => {
    /**
     * Every `wouldBecome` must be reproducible: applying that one change and re-running assess()
     * has to give exactly the stated verdict, and a null has to mean the verdict really is unmoved.
     */
    it('reports a verdict change only when re-running assess() actually produces one', () => {
      const evidence = [ev('revenue_yoy_pct', 8.4), ev('earnings_yoy_pct', 22.3), ev('annual_earnings_yoy_pct', 12)];
      const { states, out } = run(evidence);
      const current = assess(absoluteGrowthV2, states, 'YES');
      expect(out.length).toBeGreaterThan(0);

      for (const c of out) {
        const helpful = states.find((s) => s.checkId === c.checkId)!.kind === 'required' ? 'supports' : 'neutral';
        const flipped = states.map((s) =>
          s.checkId === c.checkId ? { ...s, status: 'completed' as const, outcome: helpful as 'supports' | 'neutral' } : s,
        );
        const after = assess(absoluteGrowthV2, flipped, 'YES');
        expect(c.wouldBecome, c.checkId).toBe(after === current ? null : after);
      }
    });

    it('does not claim a verdict change when one flip is not enough', () => {
      // Three separate weakening results: fixing any single one still leaves the claim weakened.
      const evidence = [
        ev('revenue_yoy_pct', 15),
        ev('earnings_yoy_pct', -11),
        ev('annual_earnings_yoy_pct', -0.5),
        ev('net_margin_change_pp', -7.1),
        ev('roe_trend_pp', -2.8),
      ];
      const { states, out } = run(evidence);
      expect(assess(absoluteGrowthV2, states, 'YES')).toBe('PARTIALLY_SUPPORTED');
      expect(out.length).toBeGreaterThan(1);
      expect(out.every((c) => c.wouldBecome === null)).toBe(true);
    });

    it('lists missing required evidence as its own condition', () => {
      const evidence = [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', 15)];
      const missing = run(evidence).out.find((c) => c.checkId === 'historical_context');
      expect(missing).toMatchObject({
        effect: 'missing_evidence',
        comparator: null,
        threshold: null,
        current: null,
        evidenceId: null,
      });
      // Two of three required checks support, so completing the third would reach SUPPORTED.
      expect(missing!.wouldBecome).toBe('SUPPORTED');
    });

    it('puts the conditions that would move the verdict first', () => {
      const evidence = [ev('revenue_yoy_pct', 8.4), ev('earnings_yoy_pct', 22.3), ev('annual_earnings_yoy_pct', 12)];
      const out = run(evidence).out;
      const decisive = out.map((c) => c.wouldBecome !== null);
      expect([...decisive].sort((a, b) => Number(b) - Number(a))).toEqual(decisive);
    });

    it('stays empty for a bearish claim, whose flip rules read backwards', () => {
      const evidence = [ev('revenue_yoy_pct', 8.4), ev('earnings_yoy_pct', 22.3)];
      const states = evaluateChecks(absoluteGrowthV2, evidence, 'bearish');
      expect(whatWouldChange(absoluteGrowthV2, states, evidence, 'bearish')).toEqual([]);
    });
  });
});
