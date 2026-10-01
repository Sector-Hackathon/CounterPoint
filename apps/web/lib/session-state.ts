import type { Assessment, ClaimReport, ClaimSeed, Coverage, ReportView, SessionEvent, StepEvent } from './api';

export interface ClaimState extends ClaimSeed {
  steps: StepEvent[];
  assessment: Assessment | null;
  stopReason: string | null;
  coverage: Coverage | null;
}

export interface SessionState {
  status: string;
  error: string | null;
  rawThesis: string | null;
  claims: ClaimState[];
  reportId: string | null;
  /** Steps that arrived before their claim (reconnect races). */
  orphanSteps: StepEvent[];
}

export const initialState: SessionState = {
  status: 'CREATED',
  error: null,
  rawThesis: null,
  claims: [],
  reportId: null,
  orphanSteps: [],
};

function addStep(steps: StepEvent[], e: StepEvent): StepEvent[] {
  if (steps.some((s) => s.id === e.id)) return steps;
  return [...steps, e].sort((a, b) => a.sequence - b.sequence);
}

/** Pure event reducer: the same event list always rebuilds the same screen, live or replayed. */
export function reduce(state: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case 'session.status':
      return { ...state, status: e.status, error: e.error };
    case 'claims.extracted': {
      const claims = e.claims
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map<ClaimState>((c) => {
          const existing = state.claims.find((x) => x.id === c.id);
          const orphans = state.orphanSteps.filter((s) => s.claimId === c.id);
          return {
            ...c,
            steps: orphans.reduce(addStep, existing?.steps ?? []),
            assessment: existing?.assessment ?? null,
            stopReason: existing?.stopReason ?? null,
            coverage: existing?.coverage ?? null,
          };
        });
      return {
        ...state,
        rawThesis: e.rawThesis,
        claims,
        orphanSteps: state.orphanSteps.filter((s) => !claims.some((c) => c.id === s.claimId)),
      };
    }
    case 'trace.step': {
      if (!state.claims.some((c) => c.id === e.claimId)) return { ...state, orphanSteps: addStep(state.orphanSteps, e) };
      return { ...state, claims: state.claims.map((c) => (c.id === e.claimId ? { ...c, steps: addStep(c.steps, e) } : c)) };
    }
    case 'claim.assessed':
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.id === e.claimId ? { ...c, assessment: e.assessment, stopReason: e.stopReason, coverage: e.coverage } : c,
        ),
      };
    case 'report.ready':
      return { ...state, reportId: e.reportId };
  }
}

export function budgetUse(c: ClaimState) {
  const tools = c.steps.filter((s) => s.action.startsWith('get_'));
  return {
    toolCalls: tools.length,
    replans: c.steps.filter((s) => s.action === 'REPLAN').length,
    counterpoints: tools.filter((s) => s.phase === 'counterpoint').length,
  };
}

/** Reports stored before v2 lack counterpoint/changeConditions; fill them so the UI never branches on undefined. */
export function normalizeReport(raw: unknown): ReportView {
  const r = raw as ReportView;
  return {
    ...r,
    claims: r.claims.map((c: Partial<ClaimReport> & ClaimReport) => ({
      ...c,
      counterpoint: c.counterpoint ?? null,
      changeConditions: c.changeConditions ?? [],
    })),
  };
}
