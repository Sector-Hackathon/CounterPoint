import { describe, expect, it } from 'vitest';
import { buildAgentFlow, stepNodeStatus } from '../lib/agent-flow';
import { initialState, type ClaimState } from '../lib/session-state';
import type { StepEvent } from '../lib/api';
const step: StepEvent = { id: 't', type: 'trace.step', claimId: 'c', sequence: 0, action: 'get_quarterly_financials', reason: 'Checking growth', resultStatus: 'RUNNING', stopReason: null, checkId: null, phase: 'required', question: null, purpose: null, rule: null, outcome: null, effect: null, opened: [], evidence: [] };
const claim: ClaimState = { id: 'c', ordinal: 0, originalText: 'growth', normalizedText: 'growth', ticker: 'BBRI', claimType: 'ABSOLUTE_GROWTH', verifiability: 'YES', scopeNote: null, direction: 'bullish', span: null, assessment: null, stopReason: null, coverage: null, steps: [] };
describe('agent flow', () => {
  it('starts with preparation running and report waiting', () => { const flow = buildAgentFlow(initialState); expect(flow.preparation.status).toBe('running'); expect(flow.report.status).toBe('waiting'); expect(flow.lanes).toEqual([]); });
  it('uses a placeholder until the first visible step arrives', () => { const flow = buildAgentFlow({ ...initialState, claims: [claim] }); expect(flow.lanes[0]!.nodes[0]!.id).toBe('waiting:c'); });
  it('keeps a node identity when a running step finishes and hides bookkeeping', () => {
    const flow = (steps: StepEvent[]) => buildAgentFlow({ ...initialState, status: 'INVESTIGATING', claims: [{ ...claim, steps }] });
    const running = flow([step]); const final = flow([{ ...step, id: 't:final', resultStatus: 'OK' }, { ...step, sequence: 1, action: 'EVALUATE', resultStatus: 'OK' }]);
    expect(final.lanes[0]!.nodes).toHaveLength(1); expect(final.lanes[0]!.nodes[0]!.id).toBe(running.lanes[0]!.nodes[0]!.id); expect(final.lanes[0]!.nodes[0]!.status).toBe('done');
  });
  it('marks unfinished steps as interrupted after a terminal session', () => { expect(stepNodeStatus(step, true)).toBe('interrupted'); expect(buildAgentFlow({ ...initialState, status: 'FAILED', claims: [{ ...claim, steps: [step] }] }).report.status).toBe('failed'); });
  it('marks errors, missing data, and out-of-scope outcomes correctly', () => { expect(stepNodeStatus({ ...step, resultStatus: 'ERROR' }, false)).toBe('failed'); expect(stepNodeStatus({ ...step, resultStatus: 'NO_DATA' }, false)).toBe('warning'); expect(stepNodeStatus({ ...step, resultStatus: 'OK', stopReason: 'OUT_OF_SCOPE' }, false)).toBe('skipped'); });
  it('shows a completed report when its id exists', () => { expect(buildAgentFlow({ ...initialState, status: 'COMPLETED', reportId: 'r' }).report.status).toBe('done'); });
});
