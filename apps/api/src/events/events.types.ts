import type { Assessment, CheckOutcome, Coverage, Span } from '@counterpoint/domain';

export interface EvidenceSummary {
  id: string;
  metric: string;
  value: number | null;
  unit: string;
  economicPeriod: string | null;
  comparisonPeriod: string | null;
  status: string;
  note: string | null;
}

export interface ClaimSeed {
  id: string;
  ordinal: number;
  originalText: string;
  normalizedText: string;
  ticker: string | null;
  claimType: string;
  verifiability: string;
  scopeNote: string | null;
  direction: string;
  span: Span | null;
}

/** Typed session events (final-week spec F3). Every event has a stable id so replay + live merge is idempotent. */
export type SessionEvent =
  | { id: string; type: 'session.status'; status: string; error: string | null }
  | { id: string; type: 'claims.extracted'; rawThesis: string; claims: ClaimSeed[] }
  | {
      id: string;
      type: 'trace.step';
      claimId: string;
      sequence: number;
      action: string;
      reason: string;
      resultStatus: string;
      stopReason: string | null;
      checkId: string | null;
      phase: 'required' | 'counter' | 'counterpoint' | null;
      hypothesis: string | null;
      expectation: CheckOutcome | null;
      expectationHeld: boolean | null;
      evidence: EvidenceSummary[];
    }
  | { id: string; type: 'claim.assessed'; claimId: string; assessment: Assessment; stopReason: string; coverage: Coverage | null }
  | { id: string; type: 'report.ready'; reportId: string };
