export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Assessment = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED' | 'UNVERIFIABLE';

export interface TraceEvent {
  id: string;
  sequence: number;
  action: string;
  reason: string;
  resultStatus: string;
  stopReason: string | null;
  evidenceIds: string[];
  planner: string | null;
}

export interface EntityView {
  id: string;
  mention: string;
  ticker: string | null;
  canonicalName: string | null;
  resolutionStatus: 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN' | 'CONFIRMED';
  candidates: { ticker: string; name: string }[];
  isPrimary: boolean;
}

export interface ClaimView {
  id: string;
  ordinal: number;
  originalText: string;
  normalizedText: string;
  ticker: string | null;
  claimType: string;
  verifiability: 'YES' | 'PARTIAL' | 'NO';
  contractId: string | null;
  assessment: Assessment | null;
  scopeNote: string | null;
  stopReason: string | null;
  extractor: string;
  trace: TraceEvent[];
}

export interface SessionView {
  id: string;
  rawThesis: string;
  status: string;
  dataMode: 'live' | 'fixture';
  error: string | null;
  entities: EntityView[];
  claims: ClaimView[];
}

export interface Statement {
  text: string;
  evidenceIds: string[];
}

export interface ClaimReport {
  claimId: string;
  assessment: Assessment;
  coverage: { required: number; completed: number; unavailable: number; invalid: number; label: string };
  supports: Statement[];
  weakens: Statement[];
  context: Statement[];
  missing: string[];
  interpretation: Statement | null;
  stopReason: string | null;
  peerSet: { policyVersion: string; period: string; included: string[]; excluded: { ticker: string; reason: string }[]; minPeers: number } | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  createThesis: (thesis: string) =>
    request<{ id: string }>('/theses', { method: 'POST', body: JSON.stringify({ thesis }) }),
  getSession: (id: string) => request<SessionView>(`/theses/${id}`),
  confirmEntity: (id: string, entityId: string, ticker: string) =>
    request<SessionView>(`/theses/${id}/entities/${entityId}/confirm`, { method: 'POST', body: JSON.stringify({ ticker }) }),
  investigate: (id: string) => request<{ status: string }>(`/theses/${id}/investigate`, { method: 'POST' }),
  getReport: (id: string) => request<ReportView>(`/theses/${id}/report`),
  getEvidence: (claimId: string) => request<{ items: EvidenceItem[] }>(`/claims/${claimId}/evidence`),
};
