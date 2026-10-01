import type {
  Claim as ClaimRow,
  EvidenceItem as EvidenceRow,
  ExecutionTrace as TraceRow,
} from '@prisma/client';
import type { Claim, EvidenceItem, ExecutionTrace } from '@counterpoint/domain';

export function toClaim(r: ClaimRow): Claim {
  return {
    id: r.id,
    sessionId: r.sessionId,
    originalText: r.originalText,
    normalizedText: r.normalizedText,
    ticker: r.ticker,
    claimType: r.claimType as Claim['claimType'],
    comparisonType: r.comparisonType as Claim['comparisonType'],
    timeScope: r.timeScope,
    verifiability: r.verifiability as Claim['verifiability'],
    contractId: r.contractId,
    assessment: r.assessment as Claim['assessment'],
    scopeNote: r.scopeNote,
    direction: 'bullish',
    span: null,
  };
}

export function toEvidence(r: EvidenceRow): EvidenceItem {
  return {
    id: r.id,
    claimId: r.claimId,
    checkId: r.checkId,
    metric: r.metric,
    ticker: r.ticker,
    value: r.value,
    unit: r.unit as EvidenceItem['unit'],
    economicPeriod: r.economicPeriod,
    comparisonPeriod: r.comparisonPeriod,
    observationDate: r.observationDate,
    retrievalTime: r.retrievalTime,
    sourceLocator: r.sourceLocator,
    derivedFrom: r.derivedFrom,
    calculationVersion: r.calculationVersion,
    status: r.status as EvidenceItem['status'],
    note: r.note,
  };
}

export function toTrace(r: TraceRow): ExecutionTrace & { planner: string | null } {
  return {
    id: r.id,
    claimId: r.claimId,
    sequence: r.sequence,
    action: r.action as ExecutionTrace['action'],
    reason: r.reason,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    evidenceIds: r.evidenceIds,
    resultStatus: r.resultStatus as ExecutionTrace['resultStatus'],
    stopReason: r.stopReason as ExecutionTrace['stopReason'],
    checkId: null,
    expectation: null,
    expectationHeld: null,
    planner: r.planner,
  };
}
