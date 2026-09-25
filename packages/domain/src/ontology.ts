import { z } from 'zod';

export const ClaimType = z.enum([
  'ABSOLUTE_GROWTH',
  'DIVIDEND_LEVEL',
  'RELATIVE_VALUATION',
  'RELATIVE_GROWTH',
  'FORWARD_LOOKING',
  'UNSUPPORTED',
]);
export type ClaimType = z.infer<typeof ClaimType>;

export const ComparisonType = z.enum(['ABSOLUTE', 'HISTORICAL', 'PEER']);
export type ComparisonType = z.infer<typeof ComparisonType>;

export const Verifiability = z.enum(['YES', 'PARTIAL', 'NO']);
export type Verifiability = z.infer<typeof Verifiability>;

export const Assessment = z.enum([
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'NOT_SUPPORTED',
  'UNVERIFIABLE',
]);
export type Assessment = z.infer<typeof Assessment>;

export const ResolutionStatus = z.enum(['RESOLVED', 'AMBIGUOUS', 'UNKNOWN', 'CONFIRMED']);
export type ResolutionStatus = z.infer<typeof ResolutionStatus>;

export const SessionStatus = z.enum([
  'CREATED',
  'AWAITING_CONFIRMATION',
  'CLAIMS_EXTRACTED',
  'INVESTIGATING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const StopReason = z.enum([
  'SUFFICIENT',
  'UNOBTAINABLE',
  'DUPLICATE',
  'OUT_OF_SCOPE',
  'BUDGET_EXHAUSTED',
  'ERROR',
]);
export type StopReason = z.infer<typeof StopReason>;

/** Whitelisted domain tools. The agent router rejects anything else. */
export const ToolName = z.enum([
  'get_company_profile',
  'get_quarterly_financials',
  'get_annual_financials',
  'get_dividend_history',
  'get_valuation_metrics',
  'get_peer_candidates',
]);
export type ToolName = z.infer<typeof ToolName>;

/** Claim types that have an evidence contract in the MVP. */
export const SUPPORTED_CLAIM_TYPES: readonly ClaimType[] = [
  'ABSOLUTE_GROWTH',
  'DIVIDEND_LEVEL',
  'RELATIVE_VALUATION',
];

/** Per-claim budget (PRD 11.1). */
export const BUDGET = {
  maxToolCalls: 6,
  maxReplans: 2,
  transientRetries: 1,
} as const;
