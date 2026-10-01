import {
  ClaimReport as ClaimReportSchema,
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
  type CounterpointHypothesis,
  getContract,
  phaseOf,
  validateStatement,
  whatWouldChange,
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
  annual_earnings_yoy_pct: 'annual net income growth',
  prior_fy_earnings_yoy_pct: 'prior-year net income growth',
  roe_pct: 'ROE',
  roe_prior_3y_avg_pct: 'prior three-year average ROE',
  roe_trend_pp: 'ROE change',
  yield_change_pct: 'yield change',
  dps_change_pct: 'dividend per share change',
  pe_own_history_median: 'own historical median P/E',
  target_pe_for_history: 'current P/E',
  pe_vs_own_history_pct: 'P/E vs own history',
  last_close: 'last close',
  high_52w: 'past-year high',
  drawdown_from_52w_high_pct: 'distance from past-year high',
  peer_median_roe_pct: 'peer median ROE',
  roe_vs_peer_median_pp: 'ROE vs peer median',
  earnings_minus_revenue_growth_pp: 'net income growth minus revenue growth',
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

  const hypotheses: CounterpointHypothesis[] = [];
  for (const s of states) {
    const check = contract?.checks.find((c) => c.id === s.checkId);
    if (check && phaseOf(check) === 'counterpoint') {
      hypotheses.push({
        checkId: s.checkId,
        hypothesis: check.hypothesis ?? check.description,
        status:
          s.status === 'completed'
            ? s.outcome === 'weakens'
              ? 'confirmed'
              : 'refuted'
            : s.status === 'pending'
              ? 'not_tested'
              : 'untestable',
        statement: s.status === 'completed' ? statementFor(s, describe(s.checkId), byId) : null,
        note: s.note,
      });
      continue;
    }
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
    counterpoint: contract && claim.direction === 'bullish' ? { hypotheses, openQuestions: contract.openQuestions ?? [] } : null,
    changeConditions: contract ? whatWouldChange(contract, states, evidence, claim.direction) : [],
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
      counterpoint: report.counterpoint
        ? {
            ...report.counterpoint,
            hypotheses: report.counterpoint.hypotheses.map((h) => (h.statement && !keep(h.statement) ? { ...h, statement: null } : h)),
          }
        : null,
      interpretation,
    },
    issues,
  };
}

/** Parses stored report content through the schema so reports saved before v2 get the new defaults. */
export function parseStoredClaims(content: unknown): ClaimReport[] {
  const claims = (content as { claims?: unknown[] } | null)?.claims ?? [];
  return claims.map((c) => ClaimReportSchema.parse(c));
}

/** Evidence lines the interpretation model may use: supports, weakens, context and confirmed counter-hypotheses. */
export function interpretationLines(section: ClaimReport): ReportStatement[] {
  const confirmed = (section.counterpoint?.hypotheses ?? [])
    .filter((h) => h.status === 'confirmed' && h.statement)
    .map((h) => h.statement!);
  return [...section.supports, ...section.weakens, ...confirmed, ...section.context];
}
