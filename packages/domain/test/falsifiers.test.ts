import { describe, expect, it } from 'vitest';
import { absoluteGrowthV2, evaluateChecks, whatWouldChange, type EvidenceItem } from '../src';

const ev = (metric: string, value: number): EvidenceItem => ({
  id: `${metric}-id`, claimId: 'c', checkId: 'x', metric, ticker: 'BBRI', value, unit: 'percent',
  economicPeriod: '2026Q2', comparisonPeriod: '2025Q2', observationDate: null, retrievalTime: 't',
  sourceLocator: 'fixture:x', derivedFrom: [], calculationVersion: 'calc-v1', status: 'VALID', note: null,
});

describe('whatWouldChange', () => {
  it('names the threshold a neutral required check would need', () => {
    const evidence = [ev('revenue_yoy_pct', 8.4), ev('earnings_yoy_pct', 22.3), ev('annual_earnings_yoy_pct', 12)];
    const out = whatWouldChange(absoluteGrowthV2, evaluateChecks(absoluteGrowthV2, evidence), evidence);
    expect(out).toContainEqual({
      checkId: 'revenue_growth', label: 'Latest-quarter revenue growth YoY', comparator: 'at_least', threshold: 10,
      current: 8.4, unit: 'percent', period: '2026Q2', evidenceId: 'revenue_yoy_pct-id', effect: 'would_support',
    });
  });

  it('says what would stop a weakening countercheck from weakening', () => {
    const evidence = [ev('revenue_yoy_pct', 12), ev('earnings_yoy_pct', -5), ev('net_margin_change_pp', -3.1)];
    const out = whatWouldChange(absoluteGrowthV2, evaluateChecks(absoluteGrowthV2, evidence), evidence);
    expect(out.find((c) => c.checkId === 'margin_deterioration')).toMatchObject({ comparator: 'above', threshold: -2, effect: 'would_stop_weakening' });
  });

  it('omits checks that already support or have no flip rule', () => {
    const evidence = [ev('revenue_yoy_pct', 15), ev('earnings_yoy_pct', 15)];
    const out = whatWouldChange(absoluteGrowthV2, evaluateChecks(absoluteGrowthV2, evidence), evidence);
    expect(out.map((c) => c.checkId)).not.toContain('revenue_growth');
    expect(out.map((c) => c.checkId)).not.toContain('revenue_earnings_divergence');
  });
});
