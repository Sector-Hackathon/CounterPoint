import { describe, expect, it } from 'vitest';
import { pollToEvents, shouldFallBack, wrapFocus } from '../lib/session-logic';

describe('SSE fallback (final review Important 1)', () => {
  it('falls back immediately when the browser has closed the stream', () => {
    expect(shouldFallBack(2, 1)).toBe(true);
  });
  it('lets EventSource retry a transient error before falling back', () => {
    expect(shouldFallBack(0, 1)).toBe(false);
    expect(shouldFallBack(0, 3)).toBe(true);
  });
});

describe('polling events (final review Important 2)', () => {
  it('emits report.ready before a terminal status so the report link appears', () => {
    const events = pollToEvents({ status: 'PARTIAL', error: null, finalReportId: 'r1' });
    expect(events.map((e) => e.type)).toEqual(['report.ready', 'session.status']);
  });
  it('emits only the status while no report exists', () => {
    expect(pollToEvents({ status: 'INVESTIGATING', error: null, finalReportId: null }).map((e) => e.type)).toEqual(['session.status']);
  });
});

describe('drawer focus wrap (final review Important 3)', () => {
  it('wraps forward from the last element to the first', () => {
    expect(wrapFocus(2, 3, false)).toBe(0);
  });
  it('wraps backward from the first element to the last', () => {
    expect(wrapFocus(0, 3, true)).toBe(2);
  });
  it('returns -1 to let the browser move focus inside the range', () => {
    expect(wrapFocus(1, 3, false)).toBe(-1);
  });
});
