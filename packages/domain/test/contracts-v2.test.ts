import { describe, expect, it } from 'vitest';
import {
  BUDGET,
  type CheckState,
  type EvidenceItem,
  absoluteGrowthV2,
  contractForClaimType,
  evaluateChecks,
  getContract,
  openChecks,
  phaseOf,
} from '../src';

const ev = (metric: string, value: number | null, status: EvidenceItem['status'] = 'VALID'): EvidenceItem => ({
  id: `${metric}-id`, claimId: 'c', checkId: 'x', metric, ticker: 'BBRI', value, unit: 'percent',
  economicPeriod: '2026Q2', comparisonPeriod: '2025Q2', observationDate: null, retrievalTime: 't',
  sourceLocator: 'fixture:x', derivedFrom: [], calculationVersion: 'calc-v1', status, note: null,
});

const requiredDone = [ev('revenue_yoy_pct', 12), ev('earnings_yoy_pct', 30), ev('annual_earnings_yoy_pct', 15)];

describe('v2 contracts', () => {
  it('maps supported claim types to v2', () => {
    expect(contractForClaimType('ABSOLUTE_GROWTH')?.id).toBe('absolute-growth-v2');
    expect(contractForClaimType('DIVIDEND_LEVEL')?.id).toBe('dividend-level-v2');
    expect(contractForClaimType('RELATIVE_VALUATION')?.id).toBe('relative-valuation-v2');
  });

  it('keeps v1 contracts registered for old reports', () => {
    expect(getContract('absolute-growth-v1').checks.some((c) => c.id === 'historical_context')).toBe(true);
  });

  it('every v2 counterpoint check has hypothesis text', () => {
    for (const id of ['absolute-growth-v2', 'dividend-level-v2', 'relative-valuation-v2']) {
      for (const c of getContract(id).checks.filter((x) => phaseOf(x) === 'counterpoint')) {
        expect(c.hypothesis?.length).toBeGreaterThan(10);
      }
    }
  });

  it('holds counterpoint checks back until required checks are resolved', () => {
    const states = evaluateChecks(absoluteGrowthV2, [ev('revenue_yoy_pct', 12)]);
    expect(openChecks(absoluteGrowthV2, states).some((c) => phaseOf(c) === 'counterpoint')).toBe(false);
  });

  it('opens counterpoint checks once required checks are done, capped by budget', () => {
    const states = evaluateChecks(absoluteGrowthV2, requiredDone);
    expect(openChecks(absoluteGrowthV2, states).some((c) => phaseOf(c) === 'counterpoint')).toBe(true);
    expect(openChecks(absoluteGrowthV2, states, BUDGET.maxCounterpoints).some((c) => phaseOf(c) === 'counterpoint')).toBe(false);
  });

  it('orders required, then counter, then counterpoint', () => {
    const phases = openChecks(absoluteGrowthV2, evaluateChecks(absoluteGrowthV2, requiredDone)).map(phaseOf);
    const first = phases.indexOf('counterpoint');
    expect(first).toBeGreaterThan(-1);
    expect(phases.slice(first).every((p) => p === 'counterpoint')).toBe(true);
  });

  it('confirms the earnings-outpacing-revenue hypothesis as weakens', () => {
    const states = evaluateChecks(absoluteGrowthV2, [ev('revenue_yoy_pct', 5), ev('earnings_yoy_pct', 30)]);
    const s = states.find((x) => x.checkId === 'earnings_outpacing_revenue') as CheckState;
    expect(s.status).toBe('completed');
    expect(s.outcome).toBe('weakens');
  });

  it('inverts required and counter outcomes for bearish claims, not counterpoint ones', () => {
    const states = evaluateChecks(absoluteGrowthV2, [ev('revenue_yoy_pct', 5), ev('earnings_yoy_pct', 30)], 'bearish');
    expect(states.find((x) => x.checkId === 'earnings_growth')!.outcome).toBe('weakens');
    expect(states.find((x) => x.checkId === 'earnings_outpacing_revenue')!.outcome).toBe('weakens');
  });
});
