import { describe, expect, it } from 'vitest';
import { budgetUse, initialState, normalizeReport, reduce } from '../lib/session-state';
import type { SessionEvent } from '../lib/api';

const claims: SessionEvent = {
  id: 'claims', type: 'claims.extracted', rawThesis: 'BBRI growth kuat',
  claims: [
    { id: 'c1', ordinal: 0, originalText: 'growth kuat', normalizedText: 'strong growth', ticker: 'BBRI', claimType: 'ABSOLUTE_GROWTH', verifiability: 'YES', scopeNote: null, direction: 'bullish', span: { start: 5, end: 16 } },
    { id: 'c2', ordinal: 1, originalText: 'pasti naik', normalizedText: 'price will rise', ticker: 'BBRI', claimType: 'FORWARD_LOOKING', verifiability: 'NO', scopeNote: 'future', direction: 'bullish', span: null },
  ],
};
const step = (seq: number, action: string, extra: Partial<Extract<SessionEvent, { type: 'trace.step' }>> = {}): SessionEvent => ({
  id: `trace:${seq}`, type: 'trace.step', claimId: 'c1', sequence: seq, action, reason: 'r', resultStatus: 'OK', stopReason: null,
  checkId: null, phase: null, hypothesis: null, expectation: null, expectationHeld: null, outcome: null, evidence: [], ...extra,
});

describe('session reducer', () => {
  it('keeps claims without a span', () => {
    const s = reduce(initialState, claims);
    expect(s.claims).toHaveLength(2);
    expect(s.claims[1]!.span).toBeNull();
  });

  it('appends steps in sequence order and ignores duplicates', () => {
    let s = reduce(initialState, claims);
    s = reduce(s, step(1, 'get_quarterly_financials'));
    s = reduce(s, step(0, 'PLAN'));
    s = reduce(s, step(1, 'get_quarterly_financials'));
    expect(s.claims[0]!.steps.map((x) => x.sequence)).toEqual([0, 1]);
  });

  it('buffers steps that arrive before claims', () => {
    let s = reduce(initialState, step(0, 'PLAN'));
    s = reduce(s, claims);
    expect(s.claims[0]!.steps).toHaveLength(1);
  });

  it('counts budget use from real steps only', () => {
    let s = reduce(initialState, claims);
    s = reduce(s, step(0, 'PLAN'));
    s = reduce(s, step(1, 'get_quarterly_financials'));
    s = reduce(s, step(2, 'REPLAN'));
    s = reduce(s, step(3, 'get_annual_financials', { phase: 'counterpoint', checkId: 'base_effect' }));
    expect(budgetUse(s.claims[0]!)).toEqual({ toolCalls: 2, replans: 1, counterpoints: 1 });
  });

  it('records assessment, report and status', () => {
    let s = reduce(initialState, claims);
    s = reduce(s, { id: 'assessed:c1', type: 'claim.assessed', claimId: 'c1', assessment: 'SUPPORTED', stopReason: 'SUFFICIENT', coverage: null });
    s = reduce(s, { id: 'report:r1', type: 'report.ready', reportId: 'r1' });
    s = reduce(s, { id: 'status:COMPLETED', type: 'session.status', status: 'COMPLETED', error: null });
    expect(s.claims[0]!.assessment).toBe('SUPPORTED');
    expect(s.reportId).toBe('r1');
    expect(s.status).toBe('COMPLETED');
  });
});

describe('normalizeReport', () => {
  it('fills counterpoint and changeConditions on reports stored before v2', () => {
    const r = normalizeReport({ id: 'r', claims: [{ claimId: 'c1', assessment: 'SUPPORTED', coverage: { required: 1, completed: 1, unavailable: 0, invalid: 0, label: 'l' }, supports: [], weakens: [], context: [], missing: [], interpretation: null, stopReason: null, peerSet: null }], disclaimer: 'd', validationStatus: 'VALID', validationIssues: [] });
    expect(r.claims[0]!.counterpoint).toBeNull();
    expect(r.claims[0]!.changeConditions).toEqual([]);
  });
});
