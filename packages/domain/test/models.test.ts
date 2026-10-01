import { describe, expect, it } from 'vitest';
import { BUDGET, Claim, ClaimReport, ExecutionTrace, StopReason } from '../src';

describe('final-week model additions', () => {
  it('raises the tool budget and caps counterpoints', () => {
    expect(BUDGET.maxToolCalls).toBe(8);
    expect(BUDGET.maxCounterpoints).toBe(3);
    expect(BUDGET.maxReplans).toBe(2);
  });

  it('accepts TIMEOUT as a stop reason', () => {
    expect(StopReason.parse('TIMEOUT')).toBe('TIMEOUT');
  });

  it('defaults new claim fields', () => {
    const c = Claim.parse({
      id: 'c', sessionId: 's', originalText: 'x', normalizedText: 'x', ticker: null, claimType: 'ABSOLUTE_GROWTH',
      comparisonType: 'HISTORICAL', timeScope: null, verifiability: 'YES', contractId: null, assessment: null, scopeNote: null,
    });
    expect(c.direction).toBe('bullish');
    expect(c.span).toBeNull();
  });

  it('defaults new trace fields', () => {
    const t = ExecutionTrace.parse({
      id: 't', claimId: 'c', sequence: 0, action: 'PLAN', reason: 'r', startedAt: 'a', finishedAt: null,
      evidenceIds: [], resultStatus: 'OK', stopReason: null,
    });
    expect(t).toMatchObject({ checkId: null, expectation: null, expectationHeld: null });
  });

  it('defaults counterpoint and change conditions on old reports', () => {
    const r = ClaimReport.parse({
      claimId: 'c', assessment: 'SUPPORTED', coverage: { required: 1, completed: 1, unavailable: 0, invalid: 0, label: 'l' },
      supports: [], weakens: [], context: [], missing: [], interpretation: null, stopReason: null, peerSet: null,
    });
    expect(r.counterpoint).toBeNull();
    expect(r.changeConditions).toEqual([]);
  });
});
