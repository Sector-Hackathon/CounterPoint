import { band, ok } from './check-helpers';
import type { EvidenceContract } from './contracts';

/**
 * v2 (final-week spec §3 fix 2, §2 F1): thresholds reviewed and no longer provisional;
 * historical context uses annual net income (bank "revenue" is not comparable across
 * companies, see docs/data-spike.md); counter-hypotheses added as the counterpoint phase.
 */
export const absoluteGrowthV2: EvidenceContract = {
  id: 'absolute-growth-v2',
  claimType: 'ABSOLUTE_GROWTH',
  description: 'Company has strong recent fundamental growth.',
  provisional: false,
  thresholds: { strongGrowthPct: 10, decelerationPp: 5, marginDeteriorationPp: 2, divergencePp: 15, roeDeclinePp: 2 },
  minRequiredCompleted: 2,
  openQuestions: [
    'Is growth concentrated in one business segment? Sectors does not expose segment data.',
    'Did one-off items (asset sales, provisions released) lift net income? Not identifiable from summary financials.',
  ],
  checks: [
    {
      id: 'revenue_growth', kind: 'required', description: 'Latest-quarter revenue growth, same quarter year-on-year',
      metrics: ['revenue_yoy_pct'], tools: ['get_quarterly_financials'],
      flip: { metric: 'revenue_yoy_pct', comparator: 'at_least', threshold: (t) => t.strongGrowthPct!, label: 'Latest-quarter revenue growth YoY', unit: 'percent' },
      evaluate: (v, t) => band(v.revenue_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'earnings_growth', kind: 'required', description: 'Latest-quarter net income growth, same quarter year-on-year',
      metrics: ['earnings_yoy_pct'], tools: ['get_quarterly_financials'],
      flip: { metric: 'earnings_yoy_pct', comparator: 'at_least', threshold: (t) => t.strongGrowthPct!, label: 'Latest-quarter net income growth YoY', unit: 'percent' },
      evaluate: (v, t) => band(v.earnings_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'historical_context', kind: 'required', description: 'Last full fiscal year net income growth',
      metrics: ['annual_earnings_yoy_pct'], tools: ['get_annual_financials'],
      flip: { metric: 'annual_earnings_yoy_pct', comparator: 'at_least', threshold: (t) => t.strongGrowthPct!, label: 'Last fiscal year net income growth', unit: 'percent' },
      evaluate: (v, t) => band(v.annual_earnings_yoy_pct!, t.strongGrowthPct!, 0),
    },
    {
      id: 'growth_deceleration', kind: 'counter', description: 'Revenue growth trend versus the prior quarter (deceleration check)',
      metrics: ['revenue_yoy_pct', 'revenue_yoy_pct_prev_quarter'], tools: ['get_quarterly_financials'],
      evaluate: (v, t) => ok(v.revenue_yoy_pct! < v.revenue_yoy_pct_prev_quarter! - t.decelerationPp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'revenue_earnings_divergence', kind: 'counter', description: 'Earnings growth versus revenue growth (divergence check)',
      metrics: ['revenue_yoy_pct', 'earnings_yoy_pct'], tools: ['get_quarterly_financials'],
      evaluate: (v, t) => ok(v.earnings_yoy_pct! - v.revenue_yoy_pct! <= -t.divergencePp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'margin_deterioration', kind: 'counter', description: 'Net margin change year-on-year (deterioration check)',
      metrics: ['net_margin_change_pp'], tools: ['get_quarterly_financials'], triggeredBy: ['revenue_earnings_divergence', 'earnings_growth'],
      flip: { metric: 'net_margin_change_pp', comparator: 'above', threshold: (t) => -t.marginDeteriorationPp!, label: 'Net margin change YoY', unit: 'percentage_points' },
      evaluate: (v, t) => ok(v.net_margin_change_pp! <= -t.marginDeteriorationPp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'base_effect', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is this growth a rebound from a weak prior year rather than new strength?',
      description: 'Prior fiscal year net income growth (base effect)',
      metrics: ['prior_fy_earnings_yoy_pct', 'earnings_yoy_pct'], tools: ['get_annual_financials'],
      evaluate: (v, t) => ok(v.prior_fy_earnings_yoy_pct! <= 0 && v.earnings_yoy_pct! >= t.strongGrowthPct! ? 'weakens' : 'neutral'),
    },
    {
      id: 'earnings_outpacing_revenue', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is profit growing much faster than revenue, so the business itself is not growing as fast as earnings suggest?',
      description: 'Net income growth minus revenue growth, latest quarter',
      metrics: ['revenue_yoy_pct', 'earnings_yoy_pct'], tools: ['get_quarterly_financials'],
      evaluate: (v, t) => ok(v.earnings_yoy_pct! - v.revenue_yoy_pct! >= t.divergencePp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'roe_trend', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is return on equity falling even while profit grows?',
      description: 'Latest fiscal year ROE versus the average of the prior three years',
      metrics: ['roe_trend_pp'], tools: ['get_annual_financials'],
      flip: { metric: 'roe_trend_pp', comparator: 'above', threshold: (t) => -t.roeDeclinePp!, label: 'ROE change vs prior 3-year average', unit: 'percentage_points' },
      evaluate: (v, t) => ok(v.roe_trend_pp! <= -t.roeDeclinePp! ? 'weakens' : 'neutral'),
    },
  ],
};

export const dividendLevelV2: EvidenceContract = {
  id: 'dividend-level-v2',
  claimType: 'DIVIDEND_LEVEL',
  description: 'Company dividend/yield is high or attractive relative to a defined baseline.',
  provisional: false,
  thresholds: { highYieldPct: 5, lowYieldPct: 2, maxDividendAgeDays: 450, oneOffSpikePct: 200, stretchPayoutPct: 90, yieldJumpPct: 20 },
  minRequiredCompleted: 2,
  openQuestions: ['Will the payout policy continue? Future dividends are not knowable from reported data.'],
  checks: [
    {
      id: 'dividend_yield', kind: 'required', description: 'Trailing dividend yield',
      metrics: ['dividend_yield_pct'], tools: ['get_dividend_history', 'get_valuation_metrics'],
      flip: { metric: 'dividend_yield_pct', comparator: 'at_least', threshold: (t) => t.highYieldPct!, label: 'Trailing dividend yield', unit: 'percent' },
      evaluate: (v, t) => band(v.dividend_yield_pct!, t.highYieldPct!, t.lowYieldPct!),
    },
    {
      id: 'yield_baseline', kind: 'required', description: 'Yield versus own historical average yield',
      metrics: ['dividend_yield_pct', 'dividend_yield_hist_avg_pct'], tools: ['get_dividend_history'],
      evaluate: (v) => ok(v.dividend_yield_pct! >= v.dividend_yield_hist_avg_pct! ? 'supports' : 'weakens'),
    },
    {
      id: 'dividend_recency', kind: 'required', description: 'Time since the latest dividend payment (recency check)',
      metrics: ['last_dividend_age_days'], tools: ['get_dividend_history'],
      evaluate: (v, t) => ok(v.last_dividend_age_days! <= t.maxDividendAgeDays! ? 'supports' : 'weakens'),
    },
    {
      id: 'one_off_dividend', kind: 'counter', description: 'Latest dividend versus prior payments (one-off check)',
      metrics: ['latest_dividend_vs_prior_median_pct'], tools: ['get_dividend_history'],
      evaluate: (v, t) => ok(v.latest_dividend_vs_prior_median_pct! >= t.oneOffSpikePct! ? 'weakens' : 'neutral'),
    },
    {
      id: 'yield_from_price', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Did the yield rise mostly because the share price fell, not because the dividend grew?',
      description: 'Change in annual yield versus change in dividend per share, latest two fiscal years',
      metrics: ['yield_change_pct', 'dps_change_pct'], tools: ['get_dividend_history'],
      evaluate: (v, t) => ok(v.yield_change_pct! >= t.yieldJumpPct! && v.dps_change_pct! < v.yield_change_pct! / 2 ? 'weakens' : 'neutral'),
    },
    {
      id: 'payout_stretch', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is the company paying out almost all of its earnings, leaving little room to keep the dividend up?',
      description: 'Payout ratio',
      metrics: ['payout_ratio_pct'], tools: ['get_dividend_history', 'get_annual_financials'],
      flip: { metric: 'payout_ratio_pct', comparator: 'below', threshold: (t) => t.stretchPayoutPct!, label: 'Payout ratio', unit: 'percent' },
      evaluate: (v, t) => ok(v.payout_ratio_pct! >= t.stretchPayoutPct! ? 'weakens' : 'neutral'),
    },
  ],
};

export const relativeValuationV2: EvidenceContract = {
  id: 'relative-valuation-v2',
  claimType: 'RELATIVE_VALUATION',
  description: 'Company is cheap/expensive compared with relevant peers.',
  provisional: false,
  thresholds: { minPeers: 4, cheapDiscountPct: 10, roeGapPp: 3, drawdownPct: 25 },
  minRequiredCompleted: 3,
  openQuestions: ['Is the market pricing in risks not visible in reported numbers (asset quality, regulation)? Not testable with Sectors data.'],
  checks: [
    {
      id: 'valuation_metric', kind: 'required', description: 'Comparable valuation metric for the target (P/E)',
      metrics: ['target_pe'], tools: ['get_valuation_metrics'],
      evaluate: (v) => (v.target_pe! > 0 ? ok('neutral') : { ok: false, reason: 'non-positive P/E is not comparable' }),
    },
    {
      id: 'peer_set', kind: 'required', description: 'Size of the frozen valid peer set',
      metrics: ['peer_count'], tools: ['get_peer_candidates'],
      evaluate: (v, t) => (v.peer_count! >= t.minPeers! ? ok('neutral') : { ok: false, reason: `only ${v.peer_count} valid peers; minimum ${t.minPeers}` }),
    },
    {
      id: 'peer_baseline', kind: 'required', description: 'Target P/E versus frozen peer median',
      metrics: ['pe_vs_peer_median_pct'], tools: ['get_valuation_metrics', 'get_peer_candidates'],
      flip: { metric: 'pe_vs_peer_median_pct', comparator: 'at_most', threshold: (t) => -t.cheapDiscountPct!, label: 'P/E versus peer median', unit: 'percent' },
      evaluate: (v, t) => band(-v.pe_vs_peer_median_pct!, t.cheapDiscountPct!, 0),
    },
    {
      id: 'pbv_cross_check', kind: 'counter', description: 'Target P/BV versus frozen peer median (cross-check)',
      metrics: ['pbv_vs_peer_median_pct'], tools: ['get_valuation_metrics', 'get_peer_candidates'],
      evaluate: (v) => ok(v.pbv_vs_peer_median_pct! >= 0 ? 'weakens' : 'neutral'),
    },
    {
      id: 'roe_vs_peers', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is it cheaper because it earns lower returns on equity than its peers?',
      description: 'Target ROE minus frozen peer median ROE, latest fiscal year',
      metrics: ['roe_vs_peer_median_pp'], tools: ['get_annual_financials', 'get_peer_candidates'],
      flip: { metric: 'roe_vs_peer_median_pp', comparator: 'above', threshold: (t) => -t.roeGapPp!, label: 'ROE versus peer median', unit: 'percentage_points' },
      evaluate: (v, t) => ok(v.roe_vs_peer_median_pp! <= -t.roeGapPp! ? 'weakens' : 'neutral'),
    },
    {
      id: 'own_history', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Is this P/E normal for this company, so it is not cheap by its own standards?',
      description: 'Current P/E versus the median of its prior fiscal years (up to 5)',
      metrics: ['pe_vs_own_history_pct'], tools: ['get_valuation_metrics'],
      flip: { metric: 'pe_vs_own_history_pct', comparator: 'below', threshold: () => 0, label: 'P/E versus own history', unit: 'percent' },
      evaluate: (v) => ok(v.pe_vs_own_history_pct! >= 0 ? 'weakens' : 'neutral'),
    },
    {
      id: 'price_drawdown', kind: 'counter', phase: 'counterpoint',
      hypothesis: 'Does the low valuation coincide with a large fall in the share price?',
      description: 'Last close versus 52-week high',
      metrics: ['drawdown_from_52w_high_pct'], tools: ['get_valuation_metrics'],
      evaluate: (v, t) => ok(v.drawdown_from_52w_high_pct! <= -t.drawdownPct! ? 'weakens' : 'neutral'),
    },
  ],
};
