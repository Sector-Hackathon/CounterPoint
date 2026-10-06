import { normalizeReport } from './session-state';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Assessment = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED' | 'UNVERIFIABLE';

export interface EntityView {
  id: string;
  mention: string;
  ticker: string | null;
  canonicalName: string | null;
  resolutionStatus: 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN' | 'CONFIRMED';
  candidates: { ticker: string; name: string }[];
  isPrimary: boolean;
}

/** Session snapshot; used for ambiguous-company confirmation and as the polling fallback. */
export interface SessionView {
  id: string;
  rawThesis: string;
  status: string;
  dataMode: 'live' | 'fixture';
  error: string | null;
  finalReportId: string | null;
  entities: EntityView[];
  claims?: { id: string; originalText: string }[];
}

export interface Statement {
  text: string;
  evidenceIds: string[];
}

export interface Coverage {
  required: number;
  completed: number;
  unavailable: number;
  invalid: number;
  label: string;
}

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

export interface StepEvent {
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
  /** The question under test, why it matters, and the rule that decides it. */
  question: string | null;
  purpose: string | null;
  rule: string | null;
  outcome: 'supports' | 'weakens' | 'neutral' | null;
  /** What the result did to the claim, and any further questions it opened. */
  effect: string | null;
  opened: string[];
  evidence: EvidenceSummary[];
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
  span: { start: number; end: number } | null;
}

export type SessionEvent =
  | { id: string; type: 'session.status'; status: string; error: string | null }
  | { id: string; type: 'claims.extracted'; rawThesis: string; claims: ClaimSeed[] }
  | StepEvent
  | { id: string; type: 'claim.assessed'; claimId: string; assessment: Assessment; stopReason: string; coverage: Coverage | null }
  | { id: string; type: 'report.ready'; reportId: string };

export interface ChangeCondition {
  checkId: string;
  label: string;
  /** Null when the evidence is simply missing: there is no measured value to move. */
  comparator: 'at_least' | 'above' | 'at_most' | 'below' | null;
  threshold: number | null;
  current: number | null;
  unit: 'percent' | 'percentage_points' | 'ratio' | null;
  period: string | null;
  evidenceId: string | null;
  effect: 'would_support' | 'would_stop_weakening' | 'missing_evidence';
  /** Set only when re-running the assessment rule with this change actually moves the verdict. */
  wouldBecome: Assessment | null;
}

export interface CounterpointHypothesis {
  checkId: string;
  hypothesis: string;
  status: 'confirmed' | 'refuted' | 'untestable' | 'not_tested' | 'not_applicable';
  statement: Statement | null;
  note: string | null;
}

export interface ClaimReport {
  claimId: string;
  assessment: Assessment;
  coverage: Coverage;
  supports: Statement[];
  weakens: Statement[];
  context: Statement[];
  missing: string[];
  interpretation: Statement | null;
  stopReason: string | null;
  peerSet: {
    policyVersion: string;
    period: string;
    included: string[];
    excluded: { ticker: string; reason: string }[];
    minPeers: number;
  } | null;
  counterpoint: { hypotheses: CounterpointHypothesis[]; openQuestions: string[] } | null;
  changeConditions: ChangeCondition[];
}

export interface ReportView {
  id: string;
  claims: ClaimReport[];
  disclaimer: string;
  validationStatus: 'VALID' | 'REPAIRED' | 'FAILED';
  validationIssues: string[];
}

export interface EvidenceItem {
  id: string;
  checkId: string;
  metric: string;
  value: number | null;
  unit: string;
  economicPeriod: string | null;
  comparisonPeriod: string | null;
  observationDate: string | null;
  retrievalTime: string;
  sourceLocator: string;
  derivedFrom: string[];
  calculationVersion: string | null;
  status: string;
  note: string | null;
}

export const eventsUrl = (id: string) => `${API_URL}/theses/${id}/events`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      if (typeof parsed.message === 'string') message = parsed.message;
    } catch {
      // non-JSON error body; show it as-is
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createThesis: (thesis: string) =>
    request<{ id: string }>('/theses', { method: 'POST', body: JSON.stringify({ thesis }) }),
  getSession: (id: string) => request<SessionView>(`/theses/${id}`),
  confirmEntity: (id: string, entityId: string, ticker: string) =>
    request<SessionView>(`/theses/${id}/entities/${entityId}/confirm`, { method: 'POST', body: JSON.stringify({ ticker }) }),
  investigate: (id: string) => request<{ status: string }>(`/theses/${id}/investigate`, { method: 'POST' }),
  getReport: async (id: string) => normalizeReport(await request<unknown>(`/theses/${id}/report`)),
  getEvidence: (claimId: string) => request<{ items: EvidenceItem[] }>(`/claims/${claimId}/evidence`),
  extractText: (imageBase64: string, mimeType: string) =>
    request<{ text: string }>('/theses/extract-text', { method: 'POST', body: JSON.stringify({ imageBase64, mimeType }) }),
};
