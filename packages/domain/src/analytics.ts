import type { Calc } from './calc';

/** YoY growth in percent. Rejects zero/negative bases where growth semantics break down. */
export function yoyGrowthPct(current: number, prior: number): Calc<number> {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) {
    return { ok: false, reason: 'non-finite input' };
  }
  if (prior === 0) return { ok: false, reason: 'prior-period value is zero' };
  if (prior < 0) {
    return { ok: false, reason: 'prior-period value is negative; growth rate is not meaningful' };
  }
  return { ok: true, value: round(((current - prior) / prior) * 100, 4) };
}

/** Margin in percent (numerator / denominator). */
export function marginPct(numerator: number, denominator: number): Calc<number> {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return { ok: false, reason: 'non-finite input' };
  }
  if (denominator <= 0) return { ok: false, reason: 'denominator is zero or negative' };
  return { ok: true, value: round((numerator / denominator) * 100, 4) };
}

/** Margin change in percentage points between two margins given in percent. */
export function marginChangePp(currentMarginPct: number, priorMarginPct: number): Calc<number> {
  if (!Number.isFinite(currentMarginPct) || !Number.isFinite(priorMarginPct)) {
    return { ok: false, reason: 'non-finite input' };
  }
  return { ok: true, value: round(currentMarginPct - priorMarginPct, 4) };
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of empty set');
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/** Linear-interpolated quantile (q in [0,1]). */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) throw new Error('quantile of empty set');
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export interface PeerDistribution {
  n: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  /** Share of peers strictly below the target value, in percent. */
  targetPercentile: number;
  targetVsMedianPct: number | null;
}

export function peerDistribution(
  target: number,
  peerValues: number[],
  minPeers: number,
): Calc<PeerDistribution> {
  const valid = peerValues.filter(Number.isFinite);
  if (valid.length < minPeers) {
    return { ok: false, reason: `only ${valid.length} valid peers; minimum is ${minPeers}` };
  }
  const med = median(valid);
  const below = valid.filter((v) => v < target).length;
  return {
    ok: true,
    value: {
      n: valid.length,
      median: round(med, 4),
      p25: round(quantile(valid, 0.25), 4),
      p75: round(quantile(valid, 0.75), 4),
      min: Math.min(...valid),
      max: Math.max(...valid),
      targetPercentile: round((below / valid.length) * 100, 2),
      targetVsMedianPct: med > 0 ? round(((target - med) / med) * 100, 4) : null,
    },
  };
}

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
