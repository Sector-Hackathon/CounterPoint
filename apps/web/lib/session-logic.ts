import type { SessionEvent } from './api';

/** EventSource.CLOSED. The browser closes for good on a non-200 reply (e.g. a 502 during a deploy). */
const CLOSED = 2;

/** Fall back to polling when the stream is closed for good, or after repeated transient errors. */
export function shouldFallBack(readyState: number, errors: number): boolean {
  return readyState === CLOSED || errors >= 3;
}

/** Events a status poll can vouch for. report.ready comes first so the report link exists before a terminal status. */
export function pollToEvents(s: { status: string; error: string | null; finalReportId: string | null }): SessionEvent[] {
  const events: SessionEvent[] = [];
  if (s.finalReportId) events.push({ id: `report:${s.finalReportId}`, type: 'report.ready', reportId: s.finalReportId });
  events.push({ id: `status:${s.status}`, type: 'session.status', status: s.status, error: s.error });
  return events;
}

/** Focus trap for a dialog: index to move to when Tab leaves the range, or -1 to let the browser handle it. */
export function wrapFocus(index: number, count: number, backwards: boolean): number {
  if (count === 0) return -1;
  if (backwards && index <= 0) return count - 1;
  if (!backwards && index >= count - 1) return 0;
  return -1;
}
