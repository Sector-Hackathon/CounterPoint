import { z } from 'zod';
import {
  Assessment,
  ClaimDirection,
  ClaimType,
  ComparisonType,
  ResolutionStatus,
  SessionStatus,
  StopReason,
  ToolName,
  Verifiability,
} from './ontology';

export const ThesisSession = z.object({
  id: z.string(),
  rawThesis: z.string(),
  status: SessionStatus,
  createdAt: z.string(),
  finalReportId: z.string().nullable(),
});
export type ThesisSession = z.infer<typeof ThesisSession>;

export const Entity = z.object({
  id: z.string(),
  sessionId: z.string(),
  mention: z.string(),
  ticker: z.string().nullable(),
  canonicalName: z.string().nullable(),
  resolutionStatus: ResolutionStatus,
  candidates: z.array(z.object({ ticker: z.string(), name: z.string() })).default([]),
  isPrimary: z.boolean().default(false),
});
export type Entity = z.infer<typeof Entity>;

export const Span = z.object({ start: z.number().int(), end: z.number().int() });
export type Span = z.infer<typeof Span>;

export const Claim = z.object({
  id: z.string(),
  sessionId: z.string(),
  originalText: z.string(),
  normalizedText: z.string(),
  ticker: z.string().nullable(),
  claimType: ClaimType,
  comparisonType: ComparisonType,
  timeScope: z.string().nullable(),
  verifiability: Verifiability,
  contractId: z.string().nullable(),
  assessment: Assessment.nullable(),
  scopeNote: z.string().nullable(),
  direction: ClaimDirection.default('bullish'),
  span: Span.nullable().default(null),
});
export type Claim = z.infer<typeof Claim>;

export const EvidenceStatus = z.enum(['VALID', 'UNAVAILABLE', 'INVALID']);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const EvidenceItem = z.object({
  id: z.string(),
  claimId: z.string(),
  checkId: z.string(),
  metric: z.string(),
  ticker: z.string(),
  value: z.number().nullable(),
  unit: z.enum(['IDR', 'percent', 'percentage_points', 'ratio', 'count']),
  economicPeriod: z.string().nullable(),
  comparisonPeriod: z.string().nullable(),
  observationDate: z.string().nullable(),
  retrievalTime: z.string(),
  sourceLocator: z.string(),
  derivedFrom: z.array(z.string()),
  calculationVersion: z.string().nullable(),
  status: EvidenceStatus,
  note: z.string().nullable(),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const TraceResult = z.enum(['RUNNING', 'OK', 'NO_DATA', 'ERROR', 'REJECTED']);
export type TraceResult = z.infer<typeof TraceResult>;

export const Expectation = z.enum(['supports', 'weakens', 'neutral']);
export type Expectation = z.infer<typeof Expectation>;

export const ExecutionTrace = z.object({
  id: z.string(),
  claimId: z.string(),
  sequence: z.number().int(),
  action: z.union([ToolName, z.enum(['PLAN', 'REPLAN', 'EVALUATE', 'STOP'])]),
  reason: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  evidenceIds: z.array(z.string()),
  resultStatus: TraceResult,
  stopReason: StopReason.nullable(),
  checkId: z.string().nullable().default(null),
  expectation: Expectation.nullable().default(null),
  expectationHeld: z.boolean().nullable().default(null),
  /** Outcome of the check this step resolved (tool steps only). */
  outcome: Expectation.nullable().default(null),
});
export type ExecutionTrace = z.infer<typeof ExecutionTrace>;

export const ReportStatement = z.object({
  text: z.string(),
  evidenceIds: z.array(z.string()),
});
export type ReportStatement = z.infer<typeof ReportStatement>;

export const ChangeCondition = z.object({
  checkId: z.string(),
  label: z.string(),
  /** Null for evidence that is simply missing: there is no measured value to move. */
  comparator: z.enum(['at_least', 'above', 'at_most', 'below']).nullable().default(null),
  threshold: z.number().nullable().default(null),
  current: z.number().nullable().default(null),
  unit: z.enum(['percent', 'percentage_points', 'ratio']).nullable().default(null),
  period: z.string().nullable(),
  evidenceId: z.string().nullable().default(null),
  /** What happens to the check if the condition is met. */
  effect: z.enum(['would_support', 'would_stop_weakening', 'missing_evidence']),
  /**
   * The assessment this one change would produce, obtained by re-running the deterministic
   * assessment rule with the check flipped. Null when the verdict would not change, so the
   * report never claims a change it cannot demonstrate.
   */
  wouldBecome: Assessment.nullable().default(null),
});
export type ChangeCondition = z.infer<typeof ChangeCondition>;

export const CounterpointHypothesis = z.object({
  checkId: z.string(),
  hypothesis: z.string(),
  /**
   * `not_applicable` means the contract never opened the question, because the result that would
   * have raised it did not occur. That is a different statement from `not_tested`, which means
   * the question was open but the budget ran out, so the two are never shown with the same words.
   */
  status: z.enum(['confirmed', 'refuted', 'untestable', 'not_tested', 'not_applicable']),
  statement: ReportStatement.nullable(),
  note: z.string().nullable(),
});
export type CounterpointHypothesis = z.infer<typeof CounterpointHypothesis>;

export const ClaimReport = z.object({
  claimId: z.string(),
  assessment: Assessment,
  coverage: z.object({
    required: z.number().int(),
    completed: z.number().int(),
    unavailable: z.number().int(),
    invalid: z.number().int(),
    label: z.string(),
  }),
  supports: z.array(ReportStatement),
  weakens: z.array(ReportStatement),
  context: z.array(ReportStatement),
  missing: z.array(z.string()),
  interpretation: ReportStatement.nullable(),
  stopReason: StopReason.nullable(),
  peerSet: z
    .object({
      policyVersion: z.string(),
      period: z.string(),
      included: z.array(z.string()),
      excluded: z.array(z.object({ ticker: z.string(), reason: z.string() })),
      minPeers: z.number().int(),
    })
    .nullable(),
  counterpoint: z
    .object({ hypotheses: z.array(CounterpointHypothesis), openQuestions: z.array(z.string()) })
    .nullable()
    .default(null),
  changeConditions: z.array(ChangeCondition).default([]),
});
export type ClaimReport = z.infer<typeof ClaimReport>;

export const ValidationStatus = z.enum(['VALID', 'REPAIRED', 'FAILED']);
export type ValidationStatus = z.infer<typeof ValidationStatus>;

export const Report = z.object({
  id: z.string(),
  sessionId: z.string(),
  claims: z.array(ClaimReport),
  disclaimer: z.string(),
  validationStatus: ValidationStatus,
  validationIssues: z.array(z.string()),
  createdAt: z.string(),
});
export type Report = z.infer<typeof Report>;

export const DISCLAIMER =
  'Counterpoint checks the evidence behind claims you provide. It is information and analysis only, not investment advice, and does not recommend buying, selling, or holding any security.';
