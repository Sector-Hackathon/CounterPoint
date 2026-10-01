import { describe, expect, it } from 'vitest';
import {
  absoluteGrowthV2,
  evaluateChecks,
  openChecks,
  phaseOf,
  relativeValuationV2,
  whatWouldChange,
  type EvidenceItem,
} from '../src';

const ev = (metric: string, value: number): EvidenceItem => ({
  id: `${metric}-id`, claimId: 'c', checkId: 'x', metric, ticker: 'BBRI', value, unit: 'percent',
  economicPeriod: '2026Q2', comparisonPeriod: '2025Q2', observationDate: null, retrievalTime: 't',
  sourceLocator: 'fixture:x', derivedFrom: [], calculationVersion: 'calc-v1', status: 'VALID', note: null,
});

describe('checkpoint review fixes', () => {
  it('a counter-hypothesis does not resolve from a required check’s evidence (finding 4)', () => {
    const states = evaluateChecks(absoluteGrowthV2, [ev('revenue_yoy_pct', 5), ev('earnings_yoy_pct', 30)]);
    expect(states.find((s) => s.checkId === 'historical_context')!.status).toBe('pending');
    expect(states.find((s) => s.checkId === 'earnings_outpacing_revenue')!.status).toBe('pending');
  });

  it('never opens counter-hypotheses for bearish claims (finding 1)', () => {
    const evidence = [ev('target_pe', 12), ev('peer_count', 6), ev('pe_vs_peer_median_pct', 20)];
    const states = evaluateChecks(relativeValuationV2, evidence, 'bearish');
    const open = openChecks(relativeValuationV2, states, 0, 'bearish');
    expect(open.some((c) => phaseOf(c) === 'counterpoint')).toBe(false);
    expect(openChecks(relativeValuationV2, states, 0, 'bullish').some((c) => phaseOf(c) === 'counterpoint')).toBe(true);
  });

  it('gives no change conditions for bearish claims rather than backwards ones (finding 2)', () => {
    const evidence = [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', 15), ev('annual_earnings_yoy_pct', 15)];
    const states = evaluateChecks(absoluteGrowthV2, evidence, 'bearish');
    expect(whatWouldChange(absoluteGrowthV2, states, evidence, 'bearish')).toEqual([]);
  });
});
