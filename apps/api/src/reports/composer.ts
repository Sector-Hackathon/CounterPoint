import {
  type CheckState,
  type Claim,
  type ClaimReport,
  type EvidenceItem,
  type FrozenPeerSet,
  type ReportStatement,
  type StopReason,
  type ValidationIssue,
  type Coverage,
  type Assessment,
  getContract,
  validateStatement,
} from '@counterpoint/domain';

const METRIC_LABELS: Record<string, string> = {
  revenue_yoy_pct: 'revenue growth YoY',
  earnings_yoy_pct: 'net income growth YoY',
  revenue_yoy_pct_prev_quarter: 'prior-quarter revenue growth YoY',
  annual_revenue_yoy_pct: 'annual revenue growth',
  net_margin_change_pp: 'net margin change',
  dividend_yield_pct: 'trailing dividend yield',
  dividend_yield_hist_avg_pct: 'historical average yield',
  last_dividend_age_days: 'days since last dividend',
  latest_dividend_vs_prior_median_pct: 'latest dividend vs prior median',
  payout_ratio_pct: 'payout ratio',
  target_pe: 'P/E',
  peer_count: 'valid peers',
  pe_vs_peer_median_pct: 'P/E vs peer median',
  pbv_vs_peer_median_pct: 'P/BV vs peer median',
};

export function formatValue(e: EvidenceItem): string {
  if (e.value === null) return 'n/a';
  switch (e.unit) {
    case 'percent':
      return `${e.value.toFixed(1)}%`;
    case 'percentage_points':
      return `${e.value.toFixed(1)} pp`;
    case 'ratio':
      return `${e.value.toFixed(2)}x`;
    case 'count':
      return String(Math.round(e.value));
    case 'IDR':
      return `IDR ${e.value.toLocaleString('en-US')}`;
  }
}

function periodLabel(e: EvidenceItem): string {
  if (e.economicPeriod && e.comparisonPeriod) return ` (${e.economicPeriod} vs ${e.comparisonPeriod})`;
  if (e.economicPeriod) return ` (${e.economicPeriod})`;
  if (e.observationDate) return ` (as of ${e.observationDate})`;
  return '';
}

function statementFor(state: CheckState, description: string, byId: Map<string, EvidenceItem>): ReportStatement {
  const items = state.evidenceIds.map((id) => byId.get(id)).filter((e): e is EvidenceItem => !!e);
  const parts = items.map((e) => `${METRIC_LABELS[e.metric] ?? e.metric} ${formatValue(e)}${periodLabel(e)}`);
  return {
    text: `${description}: ${parts.join('; ')}.`,
    evidenceIds: [...new Set(items.flatMap((e) => [e.id, ...e.derivedFrom]))],
  };
}

export interface ComposeInput {
  claim: Claim;
  assessment: Assessment;
  coverage: Coverage | null;
  states: CheckState[];
  evidence: EvidenceItem[];
  stopReason: StopReason | null;
  peerSet: FrozenPeerSet | null;
}

export function composeClaimReport(input: ComposeInput): ClaimReport {
  const { claim, states, evidence } = input;
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const contract = claim.contractId ? getContract(claim.contractId) : null;
  const describe = (id: string) => contract?.checks.find((c) => c.id === id)?.description ?? id;

  const supports: ReportStatement[] = [];
  const weakens: ReportStatement[] = [];
  const context: ReportStatement[] = [];
  const missing: string[] = [];

  for (const s of states) {
    if (s.status === 'completed') {
      const st = statementFor(s, describe(s.checkId), byId);
      (s.outcome === 'supports' ? supports : s.outcome === 'weakens' ? weakens : context).push(st);
    } else if (s.status === 'unavailable' || s.status === 'invalid') {
      missing.push(`${describe(s.checkId)}: ${s.status}${s.note ? ` — ${s.note}` : ''}`);
    } else if (s.kind === 'required') {
      missing.push(`${describe(s.checkId)}: not investigated (${input.stopReason ?? 'stopped'})`);
    }
  }
  if (!contract) missing.push(claim.scopeNote ?? 'No evidence contract covers this claim type.');

  return {
    claimId: claim.id,
    assessment: input.assessment,
    coverage: input.coverage ?? { required: 0, completed: 0, unavailable: 0, invalid: 0, label: 'No evidence contract applies' },
    supports,
    weakens,
    context,
    missing,
    interpretation: null,
    stopReason: input.stopReason,
    peerSet: input.peerSet
      ? {
          policyVersion: input.peerSet.policyVersion,
          period: input.peerSet.period,
          included: input.peerSet.included.map((p) => p.ticker),
          excluded: input.peerSet.excluded,
          minPeers: input.peerSet.minPeers,
        }
      : null,
    counterpoint: null,
    changeConditions: [],
  };
}

/** Removes any statement failing numeric reconciliation or the advice guard. */
export function validateClaimReport(
  report: ClaimReport,
  evidence: EvidenceItem[],
): { report: ClaimReport; issues: ValidationIssue[] } {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const issues: ValidationIssue[] = [];
  const keep = (s: ReportStatement) => {
    const found = validateStatement(s, byId);
    issues.push(...found);
    return found.length === 0;
  };
  const interpretation = report.interpretation && keep(report.interpretation) ? report.interpretation : null;
  return {
    report: {
      ...report,
      supports: report.supports.filter(keep),
      weakens: report.weakens.filter(keep),
      context: report.context.filter(keep),
      interpretation,
    },
    issues,
  };
}
