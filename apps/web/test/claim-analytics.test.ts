import { describe, expect, it } from 'vitest';
import { buildClaimAnalytics, scaleOf } from '../lib/claim-analytics';
import type { ClaimReport, StepEvent } from '../lib/api';
import type { ClaimState } from '../lib/session-state';

const ev = (metric: string, value: number, unit = 'percent') => ({ id: `${metric}-id`, metric, value, unit, economicPeriod: 'FY2025', comparisonPeriod: null, status: 'VALID', note: null });
const step = (seq: number, over: Partial<StepEvent>): StepEvent => ({
  id: `s${seq}`, type: 'trace.step', claimId: 'c', sequence: seq, action: 'get_dividend_history', reason: 'r', resultStatus: 'OK',
  stopReason: null, checkId: null, phase: null, question: null, purpose: null, rule: null, outcome: null, effect: null, opened: [], evidence: [], ...over,
});
const claim = (steps: StepEvent[]): ClaimState => ({
  id: 'c', ordinal: 0, originalText: 'TLKM dividennya tinggi', normalizedText: 'n', ticker: 'TLKM', claimType: 'DIVIDEND_LEVEL',
  verifiability: 'YES', scopeNote: null, direction: 'bullish', span: null, steps, assessment: null, stopReason: null, coverage: null,
} as unknown as ClaimState);

const steps = [
  step(0, { action: 'PLAN' }),
  step(1, { checkId: 'dividend_yield', phase: 'required', question: 'Apakah yield tinggi?', outcome: 'supports', evidence: [ev('dividend_yield_pct', 9.8)] }),
  step(2, { checkId: 'payout_stretch', phase: 'counterpoint', question: 'Payout di atas 90%?', outcome: 'weakens', evidence: [ev('payout_ratio_pct', 126.6)] }),
  step(3, { checkId: 'yield_from_price', phase: 'counterpoint', question: 'Yield naik karena harga turun?', outcome: 'neutral', evidence: [ev('yield_change_pct', 30.5), ev('dps_change_pct', 19)] }),
  step(4, { action: 'STOP' }),
];

describe('buildClaimAnalytics', () => {
  it('turns check steps into metric tiles with the check’s headline number', () => {
    const a = buildClaimAnalytics(claim(steps));
    expect(a.metrics).toEqual([expect.objectContaining({ checkId: 'dividend_yield', metric: 'dividend_yield_pct', value: 9.8, outcome: 'supports' })]);
  });

  it('lists counter-hypotheses as a yes/no checklist from live steps', () => {
    const a = buildClaimAnalytics(claim(steps));
    expect(a.counter.map((c) => [c.checkId, c.answer])).toEqual([['payout_stretch', 'yes'], ['yield_from_price', 'no']]);
  });

  it('prefers the report’s counterpoint statuses once the report exists', () => {
    const report = {
      claimId: 'c', assessment: 'PARTIALLY_SUPPORTED', coverage: { required: 3, completed: 3, unavailable: 0, invalid: 0, label: '' },
      supports: [], weakens: [], context: [], missing: [], interpretation: null, stopReason: 'SUFFICIENT', peerSet: null,
      counterpoint: { hypotheses: [{ checkId: 'payout_stretch', hypothesis: 'Payout di atas 90%?', status: 'confirmed', statement: null, note: null }, { checkId: 'extra', hypothesis: 'Q?', status: 'untestable', statement: null, note: 'no data' }], openQuestions: [] },
      changeConditions: [
        { checkId: 'x', label: 'L', comparator: null, threshold: null, current: null, unit: null, period: null, evidenceId: null, effect: 'missing_evidence', wouldBecome: null },
        { checkId: 'payout_stretch', label: 'Rasio pembayaran', comparator: 'below', threshold: 90, current: 126.6, unit: 'percent', period: 'FY2025', evidenceId: 'e', effect: 'would_stop_weakening', wouldBecome: 'SUPPORTED' },
      ],
    } as unknown as ClaimReport;
    const a = buildClaimAnalytics(claim(steps), report);
    expect(a.counter.map((c) => c.answer)).toEqual(['yes', 'untested']);
    expect(a.change?.checkId).toBe('payout_stretch');
    expect(a.metrics.find((m) => m.checkId === 'dividend_yield')!.scale).toBeNull();
  });

  it('builds a timeline of tool steps with their outcomes', () => {
    const a = buildClaimAnalytics(claim(steps));
    expect(a.timeline.map((t) => [t.kind, t.outcome])).toEqual([['check', 'supports'], ['counter', 'weakens'], ['counter', 'neutral']]);
  });

  it('falls back to the last measured number when a check has no headline metric', () => {
    const extra = [...steps.slice(0, 2), step(5, { checkId: 'dividend_recency', phase: 'required', outcome: 'supports', evidence: [ev('last_dividend_age_days', 111, 'count')] }), ...steps.slice(2)];
    const a = buildClaimAnalytics(claim(extra));
    expect(a.metrics.map((m) => [m.checkId, m.value])).toContainEqual(['dividend_recency', 111]);
  });
});

describe('scaleOf', () => {
  it('places value and threshold on a shared axis that includes zero', () => {
    const s = scaleOf(126.6, 90)!;
    expect(s.min).toBeLessThanOrEqual(0);
    expect(s.valuePct).toBeGreaterThan(s.thresholdPct);
    expect(s.valuePct).toBeLessThanOrEqual(100);
  });

  it('handles negative values', () => {
    const s = scaleOf(-24.7, 10)!;
    expect(s.valuePct).toBeLessThan(s.thresholdPct);
    expect(s.valuePct).toBeGreaterThanOrEqual(0);
  });
});
