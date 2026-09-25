import { describe, expect, it } from 'vitest';
import { marginChangePp, marginPct, median, peerDistribution, yoyGrowthPct } from '../src/analytics';

describe('analytics', () => {
  it('computes YoY growth', () => {
    expect(yoyGrowthPct(110, 100)).toEqual({ ok: true, value: 10 });
    expect(yoyGrowthPct(90, 100)).toEqual({ ok: true, value: -10 });
  });

  it('rejects zero and negative bases explicitly', () => {
    expect(yoyGrowthPct(10, 0).ok).toBe(false);
    expect(yoyGrowthPct(10, -5).ok).toBe(false);
  });

  it('computes margins and pp changes', () => {
    expect(marginPct(25, 100)).toEqual({ ok: true, value: 25 });
    expect(marginPct(25, 0).ok).toBe(false);
    expect(marginChangePp(22.5, 25)).toEqual({ ok: true, value: -2.5 });
  });

  it('computes medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('enforces minimum peer count', () => {
    expect(peerDistribution(8, [10, 12], 4).ok).toBe(false);
    const d = peerDistribution(8, [10, 12, 9, 14], 4);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.value.median).toBe(11);
      expect(d.value.targetPercentile).toBe(0);
      expect(d.value.targetVsMedianPct).toBeCloseTo(-27.2727, 3);
    }
  });
});
