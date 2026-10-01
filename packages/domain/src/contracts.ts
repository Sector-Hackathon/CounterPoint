import type { Calc } from './calc';
import { band, ok, type CheckOutcome } from './check-helpers';
import type { EvidenceItem } from './models';
import { BUDGET, type Assessment, type CheckPhase, type ClaimDirection, type ClaimType, type ToolName, type Verifiability } from './ontology';
import { absoluteGrowthV2, dividendLevelV2, relativeValuationV2 } from './contracts-v2';

export type { CheckOutcome } from './check-helpers';
export type CheckKind = 'required' | 'counter';
export type CheckStatus = 'pending' | 'completed' | 'unavailable' | 'invalid';

export type MetricValues = Record<string, number>;

export interface FlipRule {
  /** Evidence metric whose value is compared to the threshold. */
  metric: string;
  comparator: 'at_least' | 'above' | 'at_most' | 'below';
  threshold: (t: Thresholds) => number;
  /** Plain-language name of the measured quantity, e.g. "Latest-quarter revenue growth YoY". */
  label: string;
  unit: 'percent' | 'percentage_points' | 'ratio';
}

export interface CheckDefinition {
  id: string;
  kind: CheckKind;
  /** Counter-hypotheses run after required checks resolve (final-week spec F1). */
  phase?: 'counterpoint';
  /** User-facing question this counter-hypothesis asks. Required when phase is 'counterpoint'. */
  hypothesis?: string;
  /** Condition that would flip this check, used by whatWouldChange(). */
  flip?: FlipRule;
  description: string;
  /** Evidence metric names this check consumes. */
  metrics: string[];
  /** Whitelisted tools able to produce those metrics. */
  tools: ToolName[];
  /**
   * Counterchecks only become eligible once one of these checks has weakened the claim.
   * This is what makes the investigation path evidence-dependent rather than a fixed checklist.
   */
  triggeredBy?: string[];
  /** Deterministic evaluation; `ok: false` marks the evidence invalid for this check. */
  evaluate(values: MetricValues, t: Thresholds): Calc<CheckOutcome>;
}

export type Thresholds = Record<string, number>;

export interface EvidenceContract {
  id: string;
  claimType: ClaimType;
  description: string;
  /**
   * Thresholds that translate qualitative words ("strong", "high", "cheap") into checks.
   * Provisional until the Sectors data spike resolves PRD section 26; change only by bumping the id.
   */
  thresholds: Thresholds;
  provisional: boolean;
  /** Minimum completed required checks before any non-UNVERIFIABLE assessment. */
  minRequiredCompleted: number;
  /** Questions a reader would ask that Sectors data cannot answer; shown in the report. */
  openQuestions?: string[];
  checks: CheckDefinition[];
}

export function phaseOf(check: CheckDefinition): CheckPhase {
  if (check.phase === 'counterpoint') return 'counterpoint';
  return check.kind === 'required' ? 'required' : 'counter';
}

const INVERT: Record<CheckOutcome, CheckOutcome> = { supports: 'weakens', weakens: 'supports', neutral: 'neutral' };

export const absoluteGrowthV1: EvidenceContract = {
  id: 'absolute-growth-v1',
  claimType: 'ABSOLUTE_GROWTH',
  description: 'Company has strong recent fundamental growth.',
  provisional: true,
  thresholds: {
    strongGrowthPct: 10,
    decelerationPp: 5,
    marginDeteriorationPp: 2,
    divergencePp: 15,
  },
  minRequiredCompleted: 2,
  checks: [
    {
      id: 'revenue_growth',
      kind: 'required',
      description: 'Latest-quarter revenue growth, same quarter year-on-year',
      metrics: ['revenue_yoy_pct'],
      tools: ['get_quarterly_financials'],
      evaluate: (v, t) => band(v.revenue_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'earnings_growth',
      kind: 'required',
      description: 'Latest-quarter net income growth, same quarter year-on-year',
      metrics: ['earnings_yoy_pct'],
      tools: ['get_quarterly_financials'],
      evaluate: (v, t) => band(v.earnings_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'historical_context',
      kind: 'required',
      description: 'Last full fiscal year revenue growth',
      metrics: ['annual_revenue_yoy_pct'],
      tools: ['get_annual_financials'],
      evaluate: (v, t) => band(v.annual_revenue_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'growth_deceleration',
      kind: 'counter',
      description: 'Revenue growth trend versus the prior quarter (deceleration check)',
      metrics: ['revenue_yoy_pct', 'revenue_yoy_pct_prev_quarter'],
      tools: ['get_quarterly_financials'],
      evaluate: (v, t) =>
        ok(
          v.revenue_yoy_pct! < v.revenue_yoy_pct_prev_quarter! - t.decelerationPp!
            ? 'weakens'
            : 'neutral',
        ),
    },
    {
      id: 'revenue_earnings_divergence',
      kind: 'counter',
      description: 'Earnings growth versus revenue growth (divergence check)',
      metrics: ['revenue_yoy_pct', 'earnings_yoy_pct'],
      tools: ['get_quarterly_financials'],
      evaluate: (v, t) =>
        ok(v.earnings_yoy_pct! - v.revenue_yoy_pct! <= -t.divergencePp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'margin_deterioration',
      kind: 'counter',
      description: 'Net margin change year-on-year (deterioration check)',
      metrics: ['net_margin_change_pp'],
      tools: ['get_quarterly_financials'],
      triggeredBy: ['revenue_earnings_divergence', 'earnings_growth'],
      evaluate: (v, t) =>
        ok(v.net_margin_change_pp! <= -t.marginDeteriorationPp! ? 'weakens' : 'neutral'),
    },
  ],
};

export const dividendLevelV1: EvidenceContract = {
  id: 'dividend-level-v1',
  claimType: 'DIVIDEND_LEVEL',
  description: 'Company dividend/yield is high or attractive relative to a defined baseline.',
  provisional: true,
  thresholds: {
    highYieldPct: 5,
    lowYieldPct: 2,
    maxDividendAgeDays: 450,
    oneOffSpikePct: 200,
    maxPayoutPct: 100,
  },
  minRequiredCompleted: 2,
  checks: [
    {
      id: 'dividend_yield',
      kind: 'required',
      description: 'Trailing dividend yield',
      metrics: ['dividend_yield_pct'],
      tools: ['get_dividend_history', 'get_valuation_metrics'],
      evaluate: (v, t) => band(v.dividend_yield_pct!, t.highYieldPct!, t.lowYieldPct!),
    },
    {
      id: 'yield_baseline',
      kind: 'required',
      description: 'Yield versus own historical average yield',
      metrics: ['dividend_yield_pct', 'dividend_yield_hist_avg_pct'],
      tools: ['get_dividend_history'],
      evaluate: (v) =>
        ok(v.dividend_yield_pct! >= v.dividend_yield_hist_avg_pct! ? 'supports' : 'weakens'),
    },
    {
      id: 'dividend_recency',
      kind: 'required',
      description: 'Time since the latest dividend payment (recency check)',
      metrics: ['last_dividend_age_days'],
      tools: ['get_dividend_history'],
      evaluate: (v, t) =>
        ok(v.last_dividend_age_days! <= t.maxDividendAgeDays! ? 'supports' : 'weakens'),
    },
    {
      id: 'one_off_dividend',
      kind: 'counter',
      description: 'Latest dividend versus prior payments (one-off check)',
      metrics: ['latest_dividend_vs_prior_median_pct'],
      tools: ['get_dividend_history'],
      evaluate: (v, t) =>
        ok(v.latest_dividend_vs_prior_median_pct! >= t.oneOffSpikePct! ? 'weakens' : 'neutral'),
    },
    {
      id: 'payout_coverage',
      kind: 'counter',
      description: 'Payout ratio (coverage check)',
      metrics: ['payout_ratio_pct'],
      tools: ['get_dividend_history', 'get_annual_financials'],
      evaluate: (v, t) => ok(v.payout_ratio_pct! > t.maxPayoutPct! ? 'weakens' : 'neutral'),
    },
  ],
};

export const relativeValuationV1: EvidenceContract = {
  id: 'relative-valuation-v1',
  claimType: 'RELATIVE_VALUATION',
  description: 'Company is cheap/expensive compared with relevant peers.',
  provisional: true,
  thresholds: {
    minPeers: 4,
    cheapDiscountPct: 10,
  },
  minRequiredCompleted: 3,
  checks: [
    {
      id: 'valuation_metric',
      kind: 'required',
      description: 'Comparable valuation metric for the target (P/E)',
      metrics: ['target_pe'],
      tools: ['get_valuation_metrics'],
      evaluate: (v) =>
        v.target_pe! > 0
          ? ok('neutral')
          : { ok: false, reason: 'non-positive P/E is not comparable' },
    },
    {
      id: 'peer_set',
      kind: 'required',
      description: 'Size of the frozen valid peer set',
      metrics: ['peer_count'],
      tools: ['get_peer_candidates'],
      evaluate: (v, t) =>
        v.peer_count! >= t.minPeers!
          ? ok('neutral')
          : { ok: false, reason: `only ${v.peer_count} valid peers; minimum ${t.minPeers}` },
    },
    {
      id: 'peer_baseline',
      kind: 'required',
      description: 'Target P/E versus frozen peer median',
      metrics: ['pe_vs_peer_median_pct'],
      tools: ['get_valuation_metrics', 'get_peer_candidates'],
      evaluate: (v, t) => band(-v.pe_vs_peer_median_pct!, t.cheapDiscountPct!, 0),
    },
    {
      id: 'pbv_cross_check',
      kind: 'counter',
      description: 'Target P/BV versus frozen peer median (cross-check)',
      metrics: ['pbv_vs_peer_median_pct'],
      tools: ['get_valuation_metrics', 'get_peer_candidates'],
      evaluate: (v) => ok(v.pbv_vs_peer_median_pct! >= 0 ? 'weakens' : 'neutral'),
    },
  ],
};

export const CONTRACTS: Record<string, EvidenceContract> = {
  [absoluteGrowthV1.id]: absoluteGrowthV1,
  [dividendLevelV1.id]: dividendLevelV1,
  [relativeValuationV1.id]: relativeValuationV1,
  [absoluteGrowthV2.id]: absoluteGrowthV2,
  [dividendLevelV2.id]: dividendLevelV2,
  [relativeValuationV2.id]: relativeValuationV2,
};

/** Current contract per claim type. Older versions stay in CONTRACTS so stored reports resolve. */
const CURRENT: Partial<Record<ClaimType, EvidenceContract>> = {
  ABSOLUTE_GROWTH: absoluteGrowthV2,
  DIVIDEND_LEVEL: dividendLevelV2,
  RELATIVE_VALUATION: relativeValuationV2,
};

export function contractForClaimType(type: ClaimType): EvidenceContract | null {
  return CURRENT[type] ?? null;
}

export function getContract(id: string): EvidenceContract {
  const c = CONTRACTS[id];
  if (!c) throw new Error(`unknown evidence contract: ${id}`);
  return c;
}

export interface CheckState {
  checkId: string;
  kind: CheckKind;
  status: CheckStatus;
  outcome: CheckOutcome | null;
  evidenceIds: string[];
  note: string | null;
}

/** Derives every check's state from the claim's evidence. Latest item per metric wins. */
export function evaluateChecks(
  contract: EvidenceContract,
  evidence: EvidenceItem[],
  direction: ClaimDirection = 'bullish',
): CheckState[] {
  const byMetric = new Map<string, EvidenceItem>();
  for (const e of evidence) byMetric.set(e.metric, e);

  return contract.checks.map((check) => {
    const items = check.metrics.map((m) => byMetric.get(m));
    const base = { checkId: check.id, kind: check.kind, outcome: null, note: null };
    const ids = items.filter((i): i is EvidenceItem => !!i).map((i) => i.id);

    if (items.some((i) => !i)) return { ...base, status: 'pending', evidenceIds: ids };
    const present = items as EvidenceItem[];
    const unavailable = present.find((i) => i.status === 'UNAVAILABLE');
    if (unavailable) {
      return { ...base, status: 'unavailable', evidenceIds: ids, note: unavailable.note };
    }
    const invalid = present.find((i) => i.status === 'INVALID' || i.value === null);
    if (invalid) return { ...base, status: 'invalid', evidenceIds: ids, note: invalid.note };

    const values: MetricValues = Object.fromEntries(present.map((i) => [i.metric, i.value!]));
    const result = check.evaluate(values, contract.thresholds);
    if (!result.ok) return { ...base, status: 'invalid', evidenceIds: ids, note: result.reason };
    const outcome = direction === 'bearish' && phaseOf(check) !== 'counterpoint' ? INVERT[result.value] : result.value;
    return { ...base, status: 'completed', outcome, evidenceIds: ids };
  });
}

export interface Coverage {
  required: number;
  completed: number;
  unavailable: number;
  invalid: number;
  label: string;
}

export function evidenceCoverage(states: CheckState[]): Coverage {
  const req = states.filter((s) => s.kind === 'required');
  const completed = req.filter((s) => s.status === 'completed').length;
  return {
    required: req.length,
    completed,
    unavailable: req.filter((s) => s.status === 'unavailable').length,
    invalid: req.filter((s) => s.status === 'invalid').length,
    label: `${completed} of ${req.length} required checks available`,
  };
}

/** Deterministic assessment rule (PRD section 10). The LLM never produces the status. */
export function assess(
  contract: EvidenceContract | null,
  states: CheckState[],
  verifiability: Verifiability,
): Assessment {
  if (!contract || verifiability === 'NO') return 'UNVERIFIABLE';
  const completedRequired = states.filter((s) => s.kind === 'required' && s.status === 'completed');
  if (completedRequired.length < contract.minRequiredCompleted) return 'UNVERIFIABLE';

  const supports = completedRequired.filter((s) => s.outcome === 'supports').length;
  const weakens = states.filter((s) => s.status === 'completed' && s.outcome === 'weakens').length;
  const allRequiredDone = completedRequired.length === states.filter((s) => s.kind === 'required').length;

  if (supports === 0) return 'NOT_SUPPORTED';
  if (weakens > 0 || !allRequiredDone || verifiability === 'PARTIAL') return 'PARTIALLY_SUPPORTED';
  return 'SUPPORTED';
}

const PHASE_ORDER: Record<CheckPhase, number> = { required: 0, counter: 1, counterpoint: 2 };

/**
 * Checks still worth investigating: required, then counterchecks, then counter-hypotheses.
 * Triggered counterchecks appear only after a trigger weakened the claim. Counter-hypotheses
 * appear only once no required check is pending, and stop after BUDGET.maxCounterpoints ran.
 */
export function openChecks(contract: EvidenceContract, states: CheckState[], counterpointsRun = 0): CheckDefinition[] {
  const pending = new Set(states.filter((s) => s.status === 'pending').map((s) => s.checkId));
  const weakened = new Set(
    states.filter((s) => s.status === 'completed' && s.outcome === 'weakens').map((s) => s.checkId),
  );
  const requiredPending = states.some((s) => s.kind === 'required' && s.status === 'pending');
  return contract.checks
    .filter((c) => pending.has(c.id))
    .filter((c) => !c.triggeredBy || c.triggeredBy.some((t) => weakened.has(t)))
    .filter((c) => phaseOf(c) !== 'counterpoint' || (!requiredPending && counterpointsRun < BUDGET.maxCounterpoints))
    .sort((a, b) => PHASE_ORDER[phaseOf(a)] - PHASE_ORDER[phaseOf(b)]);
}

/** Checks that weakened the claim — the contradictions the replanner reacts to. */
export function contradictions(states: CheckState[]): string[] {
  return states.filter((s) => s.status === 'completed' && s.outcome === 'weakens').map((s) => s.checkId);
}
