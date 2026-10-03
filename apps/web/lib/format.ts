import type { ChangeCondition, StepEvent } from './api';

/** Formats a value for display. Minus signs use U+2212 so negative numbers read cleanly in tabular figures. */
export function formatValue(v: number | null, unit: string): string {
  if (v === null) return 'n/a';
  const sign = (s: string) => s.replace('-', '−');
  switch (unit) {
    case 'percent':
      return sign(`${v.toFixed(1)}%`);
    case 'percentage_points':
      return sign(`${v.toFixed(1)} pp`);
    case 'ratio':
      return `${v.toFixed(2)}×`;
    case 'count':
      return String(Math.round(v));
    case 'IDR':
      return `Rp ${v.toLocaleString('id-ID')}`;
    default:
      return String(v);
  }
}

const TOOLS: Record<string, string> = {
  get_company_profile: 'Read company profile',
  get_quarterly_financials: 'Read quarterly financials',
  get_annual_financials: 'Read annual financials',
  get_dividend_history: 'Read dividend history',
  get_valuation_metrics: 'Read valuation',
  get_peer_candidates: 'Built the peer set',
};

export function stepHeadline(s: Pick<StepEvent, 'action' | 'resultStatus'>): string {
  if (TOOLS[s.action]) return TOOLS[s.action]!;
  if (s.action === 'REPLAN') return 'Changed course';
  if (s.action === 'PLAN') return 'Picked the checks';
  if (s.action === 'STOP') return 'Stopped';
  // An EVALUATE step is only shown when something was rejected, so say that rather than "weighed".
  return s.resultStatus === 'REJECTED' ? 'Rejected a step' : 'Weighed the evidence';
}

const METRICS: Record<string, string> = {
  revenue_yoy_pct: 'Revenue growth YoY',
  earnings_yoy_pct: 'Net income growth YoY',
  annual_earnings_yoy_pct: 'Annual net income growth',
  prior_fy_earnings_yoy_pct: 'Prior-year net income growth',
  earnings_minus_revenue_growth_pp: 'Net income minus revenue growth',
  net_margin_change_pp: 'Net margin change',
  roe_trend_pp: 'ROE change',
  dividend_yield_pct: 'Trailing yield',
  dividend_yield_hist_avg_pct: 'Average yield',
  yield_change_pct: 'Yield change',
  dps_change_pct: 'Dividend per share change',
  payout_ratio_pct: 'Payout ratio',
  target_pe: 'P/E',
  peer_count: 'Valid peers',
  pe_vs_peer_median_pct: 'P/E vs peer median',
  pbv_vs_peer_median_pct: 'P/BV vs peer median',
  roe_vs_peer_median_pp: 'ROE vs peer median',
  pe_vs_own_history_pct: 'P/E vs own history',
  drawdown_from_52w_high_pct: 'From 52-week high',
};

export const metricLabel = (m: string) => METRICS[m] ?? m.replace(/_/g, ' ');

/** Derived metrics only: raw inputs (revenue, net income) stay in the evidence drawer. */
export const isHeadlineMetric = (m: string) => m in METRICS;

const CMP: Record<NonNullable<ChangeCondition['comparator']>, string> = {
  at_least: 'at least',
  above: 'above',
  at_most: 'at most',
  below: 'below',
};

export function conditionText(c: ChangeCondition): string {
  if (c.effect === 'missing_evidence' || c.comparator === null || c.threshold === null || c.current === null) {
    return `${c.label} is missing. Obtaining it would complete this check.`;
  }
  const effect = c.effect === 'would_support' ? 'to count as support' : 'to stop counting against the claim';
  const when = c.period ? ` (${c.period})` : '';
  return `${c.label} would need to be ${CMP[c.comparator]} ${formatValue(c.threshold, c.unit ?? 'percent')} ${effect}. It is ${formatValue(c.current, c.unit ?? 'percent')}${when}.`;
}
