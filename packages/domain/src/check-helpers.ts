import type { Calc } from './calc';

export type CheckOutcome = 'supports' | 'weakens' | 'neutral';

export const ok = (value: CheckOutcome): Calc<CheckOutcome> => ({ ok: true, value });

/** `supports` at or above the first bound, `weakens` below the second, `neutral` in between. */
export const band = (value: number, supportsAtLeast: number, weakensBelow: number): Calc<CheckOutcome> =>
  ok(value >= supportsAtLeast ? 'supports' : value < weakensBelow ? 'weakens' : 'neutral');
