import type { CheckOutcome } from './check-helpers';
import type { CheckDefinition, Thresholds } from './contracts';

/**
 * How a check is presented before and after its data arrives (phase 3). This is the investigation
 * policy stated in advance — the question being tested and the rule that will decide it — so the
 * trace is auditable without exposing any model reasoning. Nothing here can change an outcome:
 * `evaluate()` in the contract remains the only thing that decides, and
 * `check-presentation.test.ts` asserts every declared rule agrees with it.
 *
 * Keyed by check id, which is stable across contract versions, so the versioned contract files
 * stay frozen.
 */

export type Comparator = 'at_least' | 'above' | 'at_most' | 'below';
export type RuleUnit = 'percent' | 'percentage_points' | 'ratio' | 'count';

export interface RuleBand {
  outcome: CheckOutcome;
  comparator: Comparator;
  threshold: (t: Thresholds) => number;
}

export interface DecisionRule {
  /** Unit of the measured value, for display. */
  unit?: RuleUnit;
  /** Tested in order; the first match decides, anything else is neutral. Checked against evaluate(). */
  bands?: RuleBand[];
  /** Plain-language rule, for checks that compare two measured values rather than a constant. */
  text?: (t: Thresholds) => string;
}

const band = (outcome: CheckOutcome, comparator: Comparator, threshold: (t: Thresholds) => number): RuleBand => ({
  outcome,
  comparator,
  threshold,
});

/** Growth band shared by the three "is it growing?" checks. */
const growthBands = [
  band('supports', 'at_least', (t) => t.strongGrowthPct!),
  band('weakens', 'below', () => 0),
];

export const CHECK_QUESTIONS: Record<string, string> = {
  // absolute growth
  revenue_growth: 'Is revenue actually growing?',
  earnings_growth: 'Does net income growth confirm the revenue picture?',
  historical_context: 'Did the last full financial year grow too, or is this only a good quarter?',
  growth_deceleration: 'Is growth slowing down compared with the previous quarter?',
  revenue_earnings_divergence: 'Are profits keeping up with revenue?',
  margin_deterioration: 'Did the profit margin shrink?',
  // dividend level
  dividend_yield: 'Is the dividend yield actually high?',
  yield_baseline: 'Is the yield high by this company’s own standards?',
  dividend_recency: 'Is the dividend still being paid?',
  one_off_dividend: 'Was the latest dividend a one-off?',
  payout_coverage: 'Is the company paying out more than it earns?',
  // relative valuation
  valuation_metric: 'Is there a usable P/E to compare at all?',
  peer_set: 'Are there enough comparable peers to form a baseline?',
  peer_baseline: 'Is the P/E actually below the peer median?',
  pbv_cross_check: 'Does price-to-book agree that it is cheap?',
};

export const CHECK_RULES: Record<string, DecisionRule> = {
  revenue_growth: { unit: 'percent', bands: growthBands },
  earnings_growth: { unit: 'percent', bands: growthBands },
  historical_context: { unit: 'percent', bands: growthBands },
  growth_deceleration: {
    unit: 'percentage_points',
    text: (t) => `Growth more than ${t.decelerationPp} pp below the previous quarter weakens the claim.`,
  },
  revenue_earnings_divergence: {
    unit: 'percentage_points',
    text: (t) => `Net income growth ${t.divergencePp} pp or more below revenue growth weakens the claim.`,
  },
  margin_deterioration: {
    unit: 'percentage_points',
    bands: [band('weakens', 'at_most', (t) => -t.marginDeteriorationPp!)],
  },
  base_effect: {
    unit: 'percent',
    text: (t) => `A base year that did not grow, together with growth of at least ${t.strongGrowthPct}% now, confirms a rebound.`,
  },
  earnings_outpacing_revenue: {
    unit: 'percentage_points',
    bands: [band('weakens', 'at_least', (t) => t.divergencePp!)],
  },
  roe_trend: { unit: 'percentage_points', bands: [band('weakens', 'at_most', (t) => -t.roeDeclinePp!)] },

  dividend_yield: {
    unit: 'percent',
    bands: [
      band('supports', 'at_least', (t) => t.highYieldPct!),
      band('weakens', 'below', (t) => t.lowYieldPct!),
    ],
  },
  yield_baseline: { unit: 'percent', text: () => 'A yield at or above its own historical average supports the claim.' },
  dividend_recency: {
    unit: 'count',
    bands: [
      band('supports', 'at_most', (t) => t.maxDividendAgeDays!),
      band('weakens', 'above', (t) => t.maxDividendAgeDays!),
    ],
  },
  one_off_dividend: { unit: 'percent', bands: [band('weakens', 'at_least', (t) => t.oneOffSpikePct!)] },
  payout_coverage: { unit: 'percent', bands: [band('weakens', 'above', (t) => t.maxPayoutPct!)] },
  yield_from_price: {
    unit: 'percent',
    text: (t) =>
      `A yield jump of ${t.yieldJumpPct}% or more, while dividend per share grew less than half as fast, confirms it.`,
  },
  payout_stretch: { unit: 'percent', bands: [band('weakens', 'at_least', (t) => t.stretchPayoutPct!)] },

  valuation_metric: { unit: 'ratio', text: () => 'A positive P/E is required; zero or negative is not comparable.' },
  peer_set: { unit: 'count', text: (t) => `At least ${t.minPeers} valid peers are required, or the comparison is unavailable.` },
  peer_baseline: {
    unit: 'percent',
    bands: [
      band('supports', 'at_most', (t) => -t.cheapDiscountPct!),
      band('weakens', 'above', () => 0),
    ],
  },
  pbv_cross_check: { unit: 'percent', bands: [band('weakens', 'at_least', () => 0)] },
  roe_vs_peers: { unit: 'percentage_points', bands: [band('weakens', 'at_most', (t) => -t.roeGapPp!)] },
  own_history: { unit: 'percent', bands: [band('weakens', 'at_least', () => 0)] },
  price_drawdown: { unit: 'percent', bands: [band('weakens', 'at_most', (t) => -t.drawdownPct!)] },
};

/** The question a check answers. A counter-hypothesis already carries its own. */
export function questionFor(check: CheckDefinition): string {
  return CHECK_QUESTIONS[check.id] ?? check.hypothesis ?? check.description;
}

/** Why this check is being run, derived from its phase rather than declared per check. */
export function purposeFor(check: CheckDefinition): string {
  if (check.phase === 'counterpoint') return 'Testing the strongest case against the claim';
  return check.kind === 'required' ? 'Establishing the claim' : 'Looking for evidence against the claim';
}

const SYMBOL: Record<Comparator, string> = { at_least: '≥', above: '>', at_most: '≤', below: '<' };
const EFFECT: Record<CheckOutcome, string> = {
  supports: 'supports the claim',
  weakens: 'weakens the claim',
  neutral: 'is inconclusive',
};

function formatThreshold(value: number, unit: RuleUnit | undefined): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  switch (unit) {
    case 'percent':
      return `${n}%`;
    case 'percentage_points':
      return `${n} pp`;
    case 'ratio':
      return `${n}×`;
    default:
      return n;
  }
}

/**
 * The decision rule in words, stated before the data arrives, e.g.
 * "≥10% supports the claim · <0% weakens the claim".
 */
export function ruleTextFor(check: CheckDefinition, thresholds: Thresholds): string | null {
  const rule = CHECK_RULES[check.id];
  if (!rule) return null;
  if (rule.bands?.length) {
    return rule.bands
      .map((b) => `${SYMBOL[b.comparator]}${formatThreshold(b.threshold(thresholds), rule.unit)} ${EFFECT[b.outcome]}`)
      .join(' · ');
  }
  return rule.text?.(thresholds) ?? null;
}

/** What a resolved outcome did to the claim, for the trace. */
export function effectText(outcome: CheckOutcome): string {
  return EFFECT[outcome];
}
