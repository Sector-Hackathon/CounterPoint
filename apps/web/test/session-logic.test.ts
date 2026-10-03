import { describe, expect, it } from 'vitest';
import { isVisibleStep, pollToEvents, shouldFallBack, wrapFocus } from '../lib/session-logic';

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

describe('isVisibleStep', () => {
  const step = (action: string, resultStatus: string) => ({ action, resultStatus });

  it('hides the engine’s own bookkeeping and replaced planner proposals', () => {
    expect(isVisibleStep(step('EVALUATE', 'OK'))).toBe(false);
    expect(isVisibleStep(step('EVALUATE', 'REJECTED'))).toBe(false);
  });

  it('never hides a failure, missing data, or any real investigation step', () => {
    // A provider or retrieval failure stays on screen even though it is an EVALUATE step.
    expect(isVisibleStep(step('EVALUATE', 'ERROR'))).toBe(true);
    expect(isVisibleStep(step('EVALUATE', 'NO_DATA'))).toBe(true);
    for (const action of ['PLAN', 'REPLAN', 'STOP', 'get_quarterly_financials', 'get_peer_candidates']) {
      for (const status of ['OK', 'ERROR', 'NO_DATA', 'REJECTED']) {
        expect(isVisibleStep(step(action, status)), `${action}/${status}`).toBe(true);
      }
    }
  });
});
