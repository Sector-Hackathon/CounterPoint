import { describe, expect, it } from 'vitest';
import { selectPeers } from '../src/peers';

describe('peer policy', () => {
  const base = { subsector: 'Banks', metricPeriod: '2025Q2' };
  const result = selectPeers({
    targetTicker: 'BBRI',
    targetSubsector: 'Banks',
    period: '2025Q2',
    minPeers: 3,
    now: new Date('2026-09-26T00:00:00Z'),
    candidates: [
      { ticker: 'BBRI', ...base, metricValue: 10 },
      { ticker: 'BMRI', ...base, metricValue: 9 },
      { ticker: 'BBCA', ...base, metricValue: 22 },
      { ticker: 'BBNI', ...base, metricValue: 8 },
      { ticker: 'BRIS', ...base, metricValue: 15, metricPeriod: '2025Q1' },
      { ticker: 'ARTO', ...base, metricValue: -40 },
      { ticker: 'TLKM', subsector: 'Telecom', metricPeriod: '2025Q2', metricValue: 14 },
    ],
  });

  it('includes only comparable peers, sorted deterministically', () => {
    expect(result.included.map((p) => p.ticker)).toEqual(['BBCA', 'BBNI', 'BMRI']);
    expect(result.sufficient).toBe(true);
  });

  it('exposes every exclusion with a reason', () => {
    const reasons = Object.fromEntries(result.excluded.map((e) => [e.ticker, e.reason]));
    expect(reasons.BBRI).toBe('target company');
    expect(reasons.BRIS).toContain('period mismatch');
    expect(reasons.ARTO).toContain('non-positive');
    expect(reasons.TLKM).toContain('different subsector');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(result)).toBe(true);
  });
});
