/** Result of a deterministic calculation: a value, or an explicit reason it is not computable. */
export type Calc<T> = { ok: true; value: T } | { ok: false; reason: string };

export const CALCULATION_VERSION = 'calc-v1';
