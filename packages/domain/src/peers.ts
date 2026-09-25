export interface PeerCandidate {
  ticker: string;
  subsector: string | null;
  /** Reporting period of the metric being compared, e.g. "2025Q2". */
  metricPeriod: string | null;
  metricValue: number | null;
  businessModel?: string | null;
}

export interface PeerExclusion {
  ticker: string;
  reason: string;
}

export interface FrozenPeerSet {
  policyVersion: string;
  targetTicker: string;
  subsector: string;
  period: string;
  included: PeerCandidate[];
  excluded: PeerExclusion[];
  sufficient: boolean;
  minPeers: number;
  frozenAt: string;
}

export const PEER_POLICY_VERSION = 'peer-policy-v1';

export interface PeerPolicyInput {
  targetTicker: string;
  targetSubsector: string;
  targetBusinessModel?: string | null;
  period: string;
  minPeers: number;
  candidates: PeerCandidate[];
  now?: Date;
}

/**
 * Deterministic peer selection (PRD 13.1). The frozen set is computed before any comparative
 * result exists, and every exclusion carries a reason, so a favorable subset cannot be picked later.
 */
export function selectPeers(input: PeerPolicyInput): FrozenPeerSet {
  const included: PeerCandidate[] = [];
  const excluded: PeerExclusion[] = [];

  const sorted = [...input.candidates].sort((a, b) => a.ticker.localeCompare(b.ticker));
  for (const c of sorted) {
    const reason = exclusionReason(c, input);
    if (reason) excluded.push({ ticker: c.ticker, reason });
    else included.push(c);
  }

  return Object.freeze({
    policyVersion: PEER_POLICY_VERSION,
    targetTicker: input.targetTicker,
    subsector: input.targetSubsector,
    period: input.period,
    included,
    excluded,
    sufficient: included.length >= input.minPeers,
    minPeers: input.minPeers,
    frozenAt: (input.now ?? new Date()).toISOString(),
  });
}

function exclusionReason(c: PeerCandidate, input: PeerPolicyInput): string | null {
  if (c.ticker === input.targetTicker) return 'target company';
  if (c.subsector !== input.targetSubsector) return `different subsector (${c.subsector ?? 'unknown'})`;
  if (
    input.targetBusinessModel &&
    c.businessModel &&
    c.businessModel !== input.targetBusinessModel
  ) {
    return `incompatible business model (${c.businessModel})`;
  }
  if (c.metricValue === null || !Number.isFinite(c.metricValue)) return 'metric unavailable';
  if (c.metricValue <= 0) return 'non-positive metric value is not comparable';
  if (c.metricPeriod !== input.period) {
    return `period mismatch (${c.metricPeriod ?? 'unknown'} vs ${input.period})`;
  }
  return null;
}
