import { describe, expect, it } from 'vitest';
import {
  absoluteGrowthV1,
  assess,
  contractForClaimType,
  evaluateChecks,
  evidenceCoverage,
  openChecks,
  relativeValuationV1,
} from '../src/contracts';
import type { EvidenceItem } from '../src/models';

let seq = 0;
function ev(metric: string, value: number | null, status: EvidenceItem['status'] = 'VALID'): EvidenceItem {
  return {
    id: `ev-${++seq}`,
    claimId: 'c1',
    checkId: 'x',
    metric,
    ticker: 'BBRI',
    value,
    unit: 'percent',
    economicPeriod: '2025Q2',
    comparisonPeriod: '2024Q2',
    observationDate: null,
    retrievalTime: '2026-09-26T00:00:00Z',
    sourceLocator: 'sectors:/financials/quarterly/BBRI',
    derivedFrom: [],
    calculationVersion: 'calc-v1',
    status,
    note: status === 'VALID' ? null : 'not reported',
  };
}

describe('evidence contracts', () => {
  it('maps claim types to contracts and abstains for unsupported types', () => {
    expect(contractForClaimType('ABSOLUTE_GROWTH')?.id).toBe('absolute-growth-v2');
    expect(contractForClaimType('FORWARD_LOOKING')).toBeNull();
    expect(assess(null, [], 'NO')).toBe('UNVERIFIABLE');
  });

  it('is UNVERIFIABLE before minimum required checks complete', () => {
    const states = evaluateChecks(absoluteGrowthV1, [ev('revenue_yoy_pct', 15)]);
    expect(assess(absoluteGrowthV1, states, 'YES')).toBe('UNVERIFIABLE');
    expect(evidenceCoverage(states).label).toBe('1 of 3 required checks available');
  });

  it('SUPPORTED when all required checks support and no counterevidence', () => {
    const states = evaluateChecks(absoluteGrowthV1, [
      ev('revenue_yoy_pct', 15),
      ev('earnings_yoy_pct', 18),
      ev('annual_revenue_yoy_pct', 12),
      ev('revenue_yoy_pct_prev_quarter', 14),
      ev('net_margin_change_pp', 0.5),
    ]);
    expect(assess(absoluteGrowthV1, states, 'YES')).toBe('SUPPORTED');
  });

  it('PARTIALLY_SUPPORTED when revenue/earnings divergence weakens the claim', () => {
    const states = evaluateChecks(absoluteGrowthV1, [
      ev('revenue_yoy_pct', 20),
      ev('earnings_yoy_pct', 2),
      ev('annual_revenue_yoy_pct', 12),
    ]);
    const divergence = states.find((s) => s.checkId === 'revenue_earnings_divergence');
    expect(divergence?.outcome).toBe('weakens');
    expect(assess(absoluteGrowthV1, states, 'YES')).toBe('PARTIALLY_SUPPORTED');
  });

  it('NOT_SUPPORTED when no required check supports', () => {
    const states = evaluateChecks(absoluteGrowthV1, [
      ev('revenue_yoy_pct', -3),
      ev('earnings_yoy_pct', -8),
    ]);
    expect(assess(absoluteGrowthV1, states, 'YES')).toBe('NOT_SUPPORTED');
  });

  it('reports unavailable evidence and downgrades coverage instead of substituting', () => {
    const states = evaluateChecks(absoluteGrowthV1, [
      ev('revenue_yoy_pct', 15),
      ev('earnings_yoy_pct', null, 'UNAVAILABLE'),
    ]);
    const cov = evidenceCoverage(states);
    expect(cov.unavailable).toBe(1);
    expect(cov.completed).toBe(1);
  });

  it('marks insufficient peers invalid and abstains on relative valuation', () => {
    const states = evaluateChecks(relativeValuationV1, [
      ev('target_pe', 9),
      ev('peer_count', 2),
      ev('pe_vs_peer_median_pct', -20),
    ]);
    expect(states.find((s) => s.checkId === 'peer_set')?.status).toBe('invalid');
    expect(assess(relativeValuationV1, states, 'YES')).toBe('UNVERIFIABLE');
  });

  it('only opens triggered counterchecks after a contradiction', () => {
    const steady = evaluateChecks(absoluteGrowthV1, [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', 16)]);
    expect(openChecks(absoluteGrowthV1, steady).map((c) => c.id)).not.toContain('margin_deterioration');

    const diverging = evaluateChecks(absoluteGrowthV1, [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', -4)]);
    expect(openChecks(absoluteGrowthV1, diverging).map((c) => c.id)).toContain('margin_deterioration');
  });

  it('lists open required checks before counterchecks', () => {
    const states = evaluateChecks(absoluteGrowthV1, [ev('revenue_yoy_pct', 15)]);
    const open = openChecks(absoluteGrowthV1, states).map((c) => c.kind);
    expect(open.indexOf('counter')).toBeGreaterThan(open.lastIndexOf('required'));
  });
});
