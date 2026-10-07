import type { SessionEvent } from './api';

/** EventSource.CLOSED. The browser closes for good on a non-200 reply (e.g. a 502 during a deploy). */
const CLOSED = 2;
export function permanentSessionError(status: number): boolean { return [400, 401, 403, 404, 410].includes(status); }

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

/**
 * Which trace steps belong in the reader's thread.
 *
 * Hidden: the engine's own bookkeeping (`EVALUATE`/`OK`), and a planner proposal the guards
 * replaced (`EVALUATE`/`REJECTED`) — the action that actually ran, with its neutral rationale,
 * appears as the very next step, so showing the discarded proposal would only read as a fault.
 * Both stay in the persisted trace and in `GET /theses/:id/trace` for audit.
 *
 * Never hidden: failed retrievals and provider errors (`ERROR`), missing evidence (`NO_DATA`),
 * exhausted budgets and every real investigation outcome, which arrive as tool, REPLAN or STOP steps.
 */
export function isVisibleStep(s: { action: string; resultStatus: string }): boolean {
  if (s.action !== 'EVALUATE') return true;
  return s.resultStatus !== 'OK' && s.resultStatus !== 'REJECTED';
}

/** Focus trap for a dialog: index to move to when Tab leaves the range, or -1 to let the browser handle it. */
export function wrapFocus(index: number, count: number, backwards: boolean): number {
  if (count === 0) return -1;
  if (backwards && index <= 0) return count - 1;
  if (!backwards && index >= count - 1) return 0;
  return -1;
}
