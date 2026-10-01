import { getContract, phaseOf, type Claim, type EvidenceItem, type ExecutionTrace } from '@counterpoint/domain';
import type { ClaimSeed, EvidenceSummary, SessionEvent } from './events.types';

export function summarize(e: EvidenceItem): EvidenceSummary {
  return {
    id: e.id,
    metric: e.metric,
    value: e.value,
    unit: e.unit,
    economicPeriod: e.economicPeriod,
    comparisonPeriod: e.comparisonPeriod,
    status: e.status,
    note: e.note,
  };
}

export function stepEvent(t: ExecutionTrace, evidence: EvidenceItem[], contractId: string | null): SessionEvent {
  const check = contractId && t.checkId ? getContract(contractId).checks.find((c) => c.id === t.checkId) : undefined;
  return {
    id: `trace:${t.id}`,
    type: 'trace.step',
    claimId: t.claimId,
    sequence: t.sequence,
    action: t.action,
    reason: t.reason,
    resultStatus: t.resultStatus,
    stopReason: t.stopReason,
    checkId: t.checkId,
    phase: check ? phaseOf(check) : null,
    hypothesis: check?.hypothesis ?? null,
    expectation: t.expectation,
    expectationHeld: t.expectationHeld,
    evidence: evidence.map(summarize),
  };
}

export const statusEvent = (status: string, error: string | null = null): SessionEvent => ({
  id: `status:${status}`,
  type: 'session.status',
  status,
  error,
});

export function claimSeed(c: Claim, ordinal: number): ClaimSeed {
  return {
    id: c.id,
    ordinal,
    originalText: c.originalText,
    normalizedText: c.normalizedText,
    ticker: c.ticker,
    claimType: c.claimType,
    verifiability: c.verifiability,
    scopeNote: c.scopeNote,
    direction: c.direction,
    span: c.span,
  };
}

export const claimsEvent = (rawThesis: string, claims: ClaimSeed[]): SessionEvent => ({
  id: 'claims',
  type: 'claims.extracted',
  rawThesis,
  claims,
});
