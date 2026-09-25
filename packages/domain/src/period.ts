import { z } from 'zod';
import type { Calc } from './calc';

export const Period = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('quarter'),
    year: z.number().int(),
    quarter: z.number().int().min(1).max(4),
  }),
  z.object({ kind: z.literal('annual'), year: z.number().int() }),
]);
export type Period = z.infer<typeof Period>;

export function periodKey(p: Period): string {
  return p.kind === 'quarter' ? `${p.year}Q${p.quarter}` : `FY${p.year}`;
}

export function parsePeriodKey(key: string): Period | null {
  const q = /^(\d{4})Q([1-4])$/.exec(key);
  if (q) return { kind: 'quarter', year: Number(q[1]), quarter: Number(q[2]) };
  const a = /^FY(\d{4})$/.exec(key);
  if (a) return { kind: 'annual', year: Number(a[1]) };
  return null;
}

export function priorYearPeriod(p: Period): Period {
  return { ...p, year: p.year - 1 };
}

export function samePeriod(a: Period, b: Period): boolean {
  return periodKey(a) === periodKey(b);
}

/**
 * Same-quarter year-on-year comparability (PRD 13.2). Quarterly vs annual
 * substitutions and non-adjacent years are rejected rather than approximated.
 */
export function checkYoYComparable(current: Period, prior: Period): Calc<true> {
  if (current.kind !== prior.kind) {
    return { ok: false, reason: `incomparable period kinds: ${current.kind} vs ${prior.kind}` };
  }
  if (current.kind === 'quarter' && prior.kind === 'quarter' && current.quarter !== prior.quarter) {
    return {
      ok: false,
      reason: `seasonal mismatch: ${periodKey(current)} vs ${periodKey(prior)}`,
    };
  }
  if (current.year - prior.year !== 1) {
    return {
      ok: false,
      reason: `not a one-year gap: ${periodKey(current)} vs ${periodKey(prior)}`,
    };
  }
  return { ok: true, value: true };
}

export interface PeriodValue {
  period: Period;
  value: number;
}

/** Finds the exact prior-year counterpart; never falls back to the nearest record. */
export function findYoYPair(
  series: PeriodValue[],
  current: Period,
): Calc<{ current: PeriodValue; prior: PeriodValue }> {
  const cur = series.find((s) => samePeriod(s.period, current));
  if (!cur) return { ok: false, reason: `no data for ${periodKey(current)}` };
  const priorPeriod = priorYearPeriod(current);
  const prior = series.find((s) => samePeriod(s.period, priorPeriod));
  if (!prior) return { ok: false, reason: `no data for comparable period ${periodKey(priorPeriod)}` };
  return { ok: true, value: { current: cur, prior } };
}

export function latestPeriod(series: PeriodValue[]): Period | null {
  const sorted = [...series].sort((a, b) => periodOrdinal(b.period) - periodOrdinal(a.period));
  return sorted[0]?.period ?? null;
}

function periodOrdinal(p: Period): number {
  return p.kind === 'quarter' ? p.year * 4 + p.quarter : p.year * 4 + 4;
}
