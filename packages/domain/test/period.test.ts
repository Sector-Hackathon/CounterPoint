import { describe, expect, it } from 'vitest';
import { checkYoYComparable, findYoYPair, parsePeriodKey, periodKey } from '../src/period';

const q = (year: number, quarter: number) => ({ kind: 'quarter' as const, year, quarter });

describe('period semantics', () => {
  it('round-trips period keys', () => {
    expect(periodKey(q(2025, 2))).toBe('2025Q2');
    expect(parsePeriodKey('2025Q2')).toEqual(q(2025, 2));
    expect(parsePeriodKey('FY2024')).toEqual({ kind: 'annual', year: 2024 });
    expect(parsePeriodKey('2025-06')).toBeNull();
  });

  it('accepts same-quarter YoY', () => {
    expect(checkYoYComparable(q(2025, 2), q(2024, 2)).ok).toBe(true);
  });

  it('rejects seasonal mismatch, quarterly-vs-annual, and gaps', () => {
    expect(checkYoYComparable(q(2025, 2), q(2024, 1)).ok).toBe(false);
    expect(checkYoYComparable(q(2025, 2), { kind: 'annual', year: 2024 }).ok).toBe(false);
    expect(checkYoYComparable(q(2025, 2), q(2023, 2)).ok).toBe(false);
  });

  it('never substitutes the nearest record for a missing comparable period', () => {
    const series = [
      { period: q(2025, 2), value: 110 },
      { period: q(2024, 1), value: 100 },
    ];
    const pair = findYoYPair(series, q(2025, 2));
    expect(pair.ok).toBe(false);
    if (!pair.ok) expect(pair.reason).toContain('2024Q2');
  });
});
