import { z } from 'zod';
import {
  Assessment,
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

export const TraceResult = z.enum(['OK', 'NO_DATA', 'ERROR', 'REJECTED']);
export type TraceResult = z.infer<typeof TraceResult>;

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
});
export type ExecutionTrace = z.infer<typeof ExecutionTrace>;

export const ReportStatement = z.object({
  text: z.string(),
  evidenceIds: z.array(z.string()),
});
export type ReportStatement = z.infer<typeof ReportStatement>;

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
  missing: z.array(z.string()),
  interpretation: ReportStatement.nullable(),
  stopReason: StopReason.nullable(),
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
