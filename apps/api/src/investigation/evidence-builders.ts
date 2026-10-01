import {
  CALCULATION_VERSION,
  type EvidenceItem,
  type FrozenPeerSet,
  type Period,
  findYoYPair,
  latestPeriod,
  marginChangePp,
  marginPct,
  median,
  peerDistribution,
  periodKey,
  priorYearPeriod,
  selectPeers,
  yoyGrowthPct,
} from '@counterpoint/domain';
import type { FinancialSeries, SectorsDataSource } from '@counterpoint/sectors';

export interface BuildContext {
  claimId: string;
  ticker: string;
  source: SectorsDataSource;
  minPeers: number;
  newId: () => string;
  memo: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
  peerSet: FrozenPeerSet | null;
}

type Fields = Partial<EvidenceItem> & Pick<EvidenceItem, 'metric' | 'unit' | 'sourceLocator' | 'retrievalTime'>;

function item(ctx: BuildContext, checkId: string, f: Fields): EvidenceItem {
  return {
    id: ctx.newId(),
    claimId: ctx.claimId,
    checkId,
    ticker: ctx.ticker,
    value: null,
    economicPeriod: null,
    comparisonPeriod: null,
    observationDate: null,
    derivedFrom: [],
    calculationVersion: null,
    status: 'VALID',
    note: null,
    ...f,
  };
}

function unavailable(ctx: BuildContext, checkId: string, f: Fields, note: string): EvidenceItem[] {
  return [item(ctx, checkId, { ...f, status: 'UNAVAILABLE', value: null, note })];
}

const quarterly = (ctx: BuildContext) =>
  ctx.memo(`q:${ctx.ticker}`, () => ctx.source.getQuarterlyFinancials(ctx.ticker));
const annual = (ctx: BuildContext) =>
  ctx.memo(`a:${ctx.ticker}`, () => ctx.source.getAnnualFinancials(ctx.ticker));
const dividends = (ctx: BuildContext) =>
  ctx.memo(`d:${ctx.ticker}`, () => ctx.source.getDividendHistory(ctx.ticker));
const valuation = (ctx: BuildContext, ticker = ctx.ticker) =>
  ctx.memo(`v:${ticker}`, () => ctx.source.getValuation(ticker));
const ratios = (ctx: BuildContext, ticker = ctx.ticker) =>
  ctx.memo(`r:${ticker}`, () => ctx.source.getFinancialRatios(ticker));
const prices = (ctx: BuildContext) => ctx.memo(`px:${ctx.ticker}`, () => ctx.source.getPriceRange(ctx.ticker));

/** Anchor period: the latest period in the series. Metrics are never computed on an older fallback. */
function anchor(series: FinancialSeries): Period | null {
  return latestPeriod(series.records.map((r) => ({ period: r.period, value: 0 })));
}

function previousQuarter(p: Period): Period {
  if (p.kind !== 'quarter') return { ...p, year: p.year - 1 };
  return p.quarter === 1 ? { kind: 'quarter', year: p.year - 1, quarter: 4 } : { ...p, quarter: p.quarter - 1 };
}

function yoyMetric(
  ctx: BuildContext,
  checkId: string,
  series: FinancialSeries,
  at: Period | null,
  field: 'revenue' | 'netIncome',
  metric: string,
): EvidenceItem[] {
  const base = { metric, unit: 'percent' as const, sourceLocator: series.sourceLocator, retrievalTime: series.retrievedAt };
  if (!at) return unavailable(ctx, checkId, base, 'no reported periods');
  const values = series.records
    .filter((r) => r[field] !== null)
    .map((r) => ({ period: r.period, value: r[field] as number }));
  const pair = findYoYPair(values, at);
  if (!pair.ok) return unavailable(ctx, checkId, { ...base, economicPeriod: periodKey(at) }, pair.reason);

  const cur = item(ctx, checkId, {
    ...base,
    metric: field,
    unit: 'IDR',
    value: pair.value.current.value,
    economicPeriod: periodKey(at),
  });
  const prior = item(ctx, checkId, {
    ...base,
    metric: field,
    unit: 'IDR',
    value: pair.value.prior.value,
    economicPeriod: periodKey(pair.value.prior.period),
  });
  const growth = yoyGrowthPct(cur.value!, prior.value!);
  const derived = item(ctx, checkId, {
    ...base,
    economicPeriod: periodKey(at),
    comparisonPeriod: periodKey(pair.value.prior.period),
    derivedFrom: [cur.id, prior.id],
    calculationVersion: CALCULATION_VERSION,
    ...(growth.ok ? { value: growth.value } : { status: 'INVALID', note: growth.reason }),
  });
  return [cur, prior, derived];
}

function netMarginAt(series: FinancialSeries, p: Period) {
  const r = series.records.find((x) => periodKey(x.period) === periodKey(p));
  if (!r || r.revenue === null || r.netIncome === null) return null;
  return marginPct(r.netIncome, r.revenue);
}

type Builder = (ctx: BuildContext, checkId: string) => Promise<EvidenceItem[]>;

export const METRIC_BUILDERS: Record<string, Builder> = {
  async revenue_yoy_pct(ctx, checkId) {
    const s = await quarterly(ctx);
    return yoyMetric(ctx, checkId, s, anchor(s), 'revenue', 'revenue_yoy_pct');
  },

  async earnings_yoy_pct(ctx, checkId) {
    const s = await quarterly(ctx);
    return yoyMetric(ctx, checkId, s, anchor(s), 'netIncome', 'earnings_yoy_pct');
  },

  async revenue_yoy_pct_prev_quarter(ctx, checkId) {
    const s = await quarterly(ctx);
    const a = anchor(s);
    return yoyMetric(ctx, checkId, s, a && previousQuarter(a), 'revenue', 'revenue_yoy_pct_prev_quarter');
  },

  async annual_revenue_yoy_pct(ctx, checkId) {
    const s = await annual(ctx);
    return yoyMetric(ctx, checkId, s, anchor(s), 'revenue', 'annual_revenue_yoy_pct');
  },

  async annual_earnings_yoy_pct(ctx, checkId) {
    const s = await annual(ctx);
    return yoyMetric(ctx, checkId, s, anchor(s), 'netIncome', 'annual_earnings_yoy_pct');
  },

  async earnings_minus_revenue_growth_pp(ctx, checkId) {
    const s = await quarterly(ctx);
    const at = anchor(s);
    const earnings = yoyMetric(ctx, checkId, s, at, 'netIncome', 'earnings_yoy_pct');
    const revenue = yoyMetric(ctx, checkId, s, at, 'revenue', 'revenue_yoy_pct');
    const e = earnings.find((i) => i.metric === 'earnings_yoy_pct')!;
    const r = revenue.find((i) => i.metric === 'revenue_yoy_pct')!;
    const base = {
      metric: 'earnings_minus_revenue_growth_pp',
      unit: 'percentage_points' as const,
      sourceLocator: s.sourceLocator,
      retrievalTime: s.retrievedAt,
      economicPeriod: e.economicPeriod,
      comparisonPeriod: e.comparisonPeriod,
    };
    if (e.value === null || r.value === null) {
      return [...earnings, ...revenue, ...unavailable(ctx, checkId, base, 'revenue or net income growth not available')];
    }
    return [
      ...earnings,
      ...revenue,
      item(ctx, checkId, {
        ...base,
        value: Math.round((e.value - r.value) * 100) / 100,
        derivedFrom: [e.id, r.id],
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async prior_fy_earnings_yoy_pct(ctx, checkId) {
    const s = await annual(ctx);
    const a = anchor(s);
    return yoyMetric(ctx, checkId, s, a && { kind: 'annual', year: a.year - 1 }, 'netIncome', 'prior_fy_earnings_yoy_pct');
  },

  async roe_trend_pp(ctx, checkId) {
    const r = await ratios(ctx);
    const base = { metric: 'roe_trend_pp', unit: 'percentage_points' as const, sourceLocator: r.sourceLocator, retrievalTime: r.retrievedAt };
    const years = r.records.filter((x): x is { year: number; roePct: number } => x.roePct !== null).slice(-4);
    if (years.length < 4) return unavailable(ctx, checkId, base, `only ${years.length} years of ROE; need 4`);
    const [p1, p2, p3, latest] = years as [(typeof years)[0], (typeof years)[0], (typeof years)[0], (typeof years)[0]];
    const priorAvg = (p1.roePct + p2.roePct + p3.roePct) / 3;
    const window = `FY${p1.year}-FY${p3.year}`;
    const latestItem = item(ctx, checkId, { ...base, metric: 'roe_pct', unit: 'percent', value: latest.roePct, economicPeriod: `FY${latest.year}` });
    const avgItem = item(ctx, checkId, {
      ...base,
      metric: 'roe_prior_3y_avg_pct',
      unit: 'percent',
      value: Math.round(priorAvg * 100) / 100,
      economicPeriod: window,
      calculationVersion: CALCULATION_VERSION,
    });
    return [
      latestItem,
      avgItem,
      item(ctx, checkId, {
        ...base,
        value: Math.round((latest.roePct - priorAvg) * 100) / 100,
        economicPeriod: `FY${latest.year}`,
        comparisonPeriod: window,
        derivedFrom: [latestItem.id, avgItem.id],
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  yield_change_pct: (ctx, checkId) => dividendChange(ctx, checkId, 'yield_change_pct'),
  dps_change_pct: (ctx, checkId) => dividendChange(ctx, checkId, 'dps_change_pct'),

  async pe_vs_own_history_pct(ctx, checkId) {
    const v = await valuation(ctx);
    const base = { metric: 'pe_vs_own_history_pct', unit: 'percent' as const, sourceLocator: v.sourceLocator, retrievalTime: v.retrievedAt, observationDate: v.asOf };
    if (v.pe === null || v.pe <= 0) return unavailable(ctx, checkId, base, 'current P/E not comparable');
    const latestYear = Math.max(...v.peHistory.map((h) => h.year), 0);
    const prior = v.peHistory.filter((h) => h.year < latestYear && h.pe > 0).slice(-5);
    if (prior.length < 3) return unavailable(ctx, checkId, base, `only ${prior.length} prior years of P/E; need 3`);
    const med = median(prior.map((h) => h.pe));
    const window = `FY${prior[0]!.year}-FY${prior[prior.length - 1]!.year}`;
    const medItem = item(ctx, checkId, {
      ...base,
      metric: 'pe_own_history_median',
      unit: 'ratio',
      value: Math.round(med * 100) / 100,
      economicPeriod: window,
      calculationVersion: CALCULATION_VERSION,
    });
    const curItem = item(ctx, checkId, { ...base, metric: 'target_pe_for_history', unit: 'ratio', value: v.pe });
    return [
      medItem,
      curItem,
      item(ctx, checkId, {
        ...base,
        value: Math.round(((v.pe - med) / med) * 10_000) / 100,
        comparisonPeriod: window,
        derivedFrom: [curItem.id, medItem.id],
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async drawdown_from_52w_high_pct(ctx, checkId) {
    const p = await prices(ctx);
    const base = { metric: 'drawdown_from_52w_high_pct', unit: 'percent' as const, sourceLocator: p.sourceLocator, retrievalTime: p.retrievedAt, observationDate: p.asOf };
    if (p.lastClose === null || p.high52w === null || p.high52w <= 0) {
      return unavailable(ctx, checkId, base, '52-week high or last close not reported');
    }
    const closeItem = item(ctx, checkId, { ...base, metric: 'last_close', unit: 'IDR', value: p.lastClose });
    const highItem = item(ctx, checkId, { ...base, metric: 'high_52w', unit: 'IDR', value: p.high52w, observationDate: p.high52wDate });
    return [
      closeItem,
      highItem,
      item(ctx, checkId, {
        ...base,
        value: Math.round((p.lastClose / p.high52w - 1) * 10_000) / 100,
        derivedFrom: [closeItem.id, highItem.id],
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async roe_vs_peer_median_pp(ctx, checkId) {
    const set = await freezePeerSet(ctx);
    const own = await ratios(ctx);
    const base = { metric: 'roe_vs_peer_median_pp', unit: 'percentage_points' as const, sourceLocator: own.sourceLocator, retrievalTime: own.retrievedAt };
    const latest = [...own.records].reverse().find((x) => x.roePct !== null);
    if (!latest) return unavailable(ctx, checkId, base, 'target ROE not reported');
    const peerRoe = await Promise.all(
      set.included.map(async (p) => (await ratios(ctx, p.ticker)).records.find((x) => x.year === latest.year)?.roePct ?? null),
    );
    const valid = peerRoe.filter((v): v is number => v !== null);
    if (valid.length < ctx.minPeers) {
      return unavailable(
        ctx,
        checkId,
        { ...base, economicPeriod: `FY${latest.year}` },
        `only ${valid.length} peers report FY${latest.year} ROE; need ${ctx.minPeers}`,
      );
    }
    const med = median(valid);
    const ownItem = item(ctx, checkId, { ...base, metric: 'roe_pct', unit: 'percent', value: latest.roePct, economicPeriod: `FY${latest.year}` });
    const medItem = item(ctx, checkId, {
      ...base,
      metric: 'peer_median_roe_pct',
      unit: 'percent',
      value: Math.round(med * 100) / 100,
      economicPeriod: `FY${latest.year}`,
      sourceLocator: set.locator,
      calculationVersion: CALCULATION_VERSION,
      note: `n=${valid.length}; peers: ${set.included.map((p) => p.ticker).join(', ')}`,
    });
    return [
      ownItem,
      medItem,
      item(ctx, checkId, {
        ...base,
        value: Math.round((latest.roePct! - med) * 100) / 100,
        economicPeriod: `FY${latest.year}`,
        derivedFrom: [ownItem.id, medItem.id],
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async net_margin_change_pp(ctx, checkId) {
    const s = await quarterly(ctx);
    const base = {
      metric: 'net_margin_change_pp',
      unit: 'percentage_points' as const,
      sourceLocator: s.sourceLocator,
      retrievalTime: s.retrievedAt,
    };
    const at = anchor(s);
    if (!at) return unavailable(ctx, checkId, base, 'no reported periods');
    const prior = priorYearPeriod(at);
    const cur = netMarginAt(s, at);
    const prev = netMarginAt(s, prior);
    const where = { economicPeriod: periodKey(at), comparisonPeriod: periodKey(prior) };
    if (!cur || !prev) return unavailable(ctx, checkId, { ...base, ...where }, 'revenue or net income missing');
    if (!cur.ok || !prev.ok) {
      return [item(ctx, checkId, { ...base, ...where, status: 'INVALID', note: cur.ok ? (prev as { reason: string }).reason : cur.reason })];
    }
    const curItem = item(ctx, checkId, { ...base, metric: 'net_margin_pct', unit: 'percent', value: cur.value, economicPeriod: periodKey(at) });
    const prevItem = item(ctx, checkId, { ...base, metric: 'net_margin_pct', unit: 'percent', value: prev.value, economicPeriod: periodKey(prior) });
    const change = marginChangePp(cur.value, prev.value);
    return [
      curItem,
      prevItem,
      item(ctx, checkId, {
        ...base,
        ...where,
        derivedFrom: [curItem.id, prevItem.id],
        calculationVersion: CALCULATION_VERSION,
        ...(change.ok ? { value: change.value } : { status: 'INVALID', note: change.reason }),
      }),
    ];
  },

  async dividend_yield_pct(ctx, checkId) {
    const d = await dividends(ctx);
    const base = { metric: 'dividend_yield_pct', unit: 'percent' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
    if (d.trailingYieldPct === null) return unavailable(ctx, checkId, base, 'trailing yield not reported');
    return [item(ctx, checkId, { ...base, value: d.trailingYieldPct, economicPeriod: 'TTM', observationDate: d.retrievedAt.slice(0, 10) })];
  },

  async dividend_yield_hist_avg_pct(ctx, checkId) {
    const d = await dividends(ctx);
    const base = { metric: 'dividend_yield_hist_avg_pct', unit: 'percent' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
    // Completed fiscal years only: Sectors reports the retrieval year as a partial year.
    const currentYear = Number(d.retrievedAt.slice(0, 4));
    const years = d.annualYieldsPct
      .filter((y) => y.year < currentYear)
      .sort((a, b) => b.year - a.year)
      .slice(0, 5);
    if (years.length < 3) return unavailable(ctx, checkId, base, `only ${years.length} years of yield history; need 3`);
    const avg = years.reduce((s, y) => s + y.yieldPct, 0) / years.length;
    return [
      item(ctx, checkId, {
        ...base,
        value: Math.round(avg * 100) / 100,
        economicPeriod: `FY${years[years.length - 1]!.year}-FY${years[0]!.year}`,
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async last_dividend_age_days(ctx, checkId) {
    const d = await dividends(ctx);
    const base = { metric: 'last_dividend_age_days', unit: 'count' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
    const last = d.payments[d.payments.length - 1];
    if (!last) return unavailable(ctx, checkId, base, 'no dividend payments reported');
    const days = Math.floor((Date.parse(d.retrievedAt) - Date.parse(last.date)) / 86_400_000);
    return [item(ctx, checkId, { ...base, value: days, observationDate: last.date, calculationVersion: CALCULATION_VERSION })];
  },

  async latest_dividend_vs_prior_median_pct(ctx, checkId) {
    const d = await dividends(ctx);
    const base = { metric: 'latest_dividend_vs_prior_median_pct', unit: 'percent' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
    if (d.payments.length < 3) return unavailable(ctx, checkId, base, 'fewer than 3 dividend payments');
    const latest = d.payments[d.payments.length - 1]!;
    const prior = median(d.payments.slice(0, -1).map((p) => p.amountPerShare));
    if (prior <= 0) return [item(ctx, checkId, { ...base, status: 'INVALID', note: 'non-positive prior dividends' })];
    return [
      item(ctx, checkId, {
        ...base,
        value: Math.round((latest.amountPerShare / prior) * 10_000) / 100,
        observationDate: latest.date,
        calculationVersion: CALCULATION_VERSION,
      }),
    ];
  },

  async payout_ratio_pct(ctx, checkId) {
    const d = await dividends(ctx);
    const base = { metric: 'payout_ratio_pct', unit: 'percent' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
    if (d.payoutRatioPct === null) return unavailable(ctx, checkId, base, 'payout ratio not reported');
    return [item(ctx, checkId, { ...base, value: d.payoutRatioPct })];
  },

  async target_pe(ctx, checkId) {
    const v = await valuation(ctx);
    const base = { metric: 'target_pe', unit: 'ratio' as const, sourceLocator: v.sourceLocator, retrievalTime: v.retrievedAt };
    if (v.pe === null) return unavailable(ctx, checkId, base, 'P/E not reported');
    return [item(ctx, checkId, { ...base, value: v.pe, observationDate: v.asOf })];
  },

  async peer_count(ctx, checkId) {
    const set = await freezePeerSet(ctx);
    return [
      item(ctx, checkId, {
        metric: 'peer_count',
        unit: 'count',
        value: set.included.length,
        observationDate: set.period,
        sourceLocator: set.locator,
        retrievalTime: set.frozenAt,
        calculationVersion: set.policyVersion,
        note: `included: ${set.included.map((p) => p.ticker).join(', ') || 'none'}; excluded: ${set.excluded.length}`,
      }),
    ];
  },

  pe_vs_peer_median_pct: (ctx, checkId) => relativeToPeers(ctx, checkId, 'pe', 'pe_vs_peer_median_pct'),
  pbv_vs_peer_median_pct: (ctx, checkId) => relativeToPeers(ctx, checkId, 'pbv', 'pbv_vs_peer_median_pct'),
};

async function freezePeerSet(ctx: BuildContext): Promise<FrozenPeerSet & { locator: string }> {
  const target = await valuation(ctx);
  const profile = await ctx.memo(`p:${ctx.ticker}`, () => ctx.source.getCompanyProfile(ctx.ticker));
  const subsector = profile?.subsector ?? 'unknown';
  const candidates = await ctx.memo(`peers:${subsector}`, () => ctx.source.getPeerCandidates(subsector));
  if (!ctx.peerSet) {
    const withValues = await Promise.all(
      candidates.candidates.map(async (c) => {
        const v = await valuation(ctx, c.ticker);
        return { ticker: c.ticker, subsector: c.subsector, metricPeriod: v.asOf, metricValue: v.pe };
      }),
    );
    ctx.peerSet = selectPeers({
      targetTicker: ctx.ticker,
      targetSubsector: subsector,
      period: target.asOf ?? 'unknown',
      minPeers: ctx.minPeers,
      candidates: withValues,
    });
  }
  return { ...ctx.peerSet, locator: candidates.sourceLocator };
}

async function relativeToPeers(
  ctx: BuildContext,
  checkId: string,
  field: 'pe' | 'pbv',
  metric: string,
): Promise<EvidenceItem[]> {
  const set = await freezePeerSet(ctx);
  const target = await valuation(ctx);
  const base = { metric, unit: 'percent' as const, sourceLocator: set.locator, retrievalTime: set.frozenAt, observationDate: set.period };
  const targetValue = target[field];
  if (targetValue === null || targetValue <= 0) return unavailable(ctx, checkId, base, `target ${field} not comparable`);
  const peerValues = await Promise.all(set.included.map(async (p) => (await valuation(ctx, p.ticker))[field]));
  const dist = peerDistribution(
    targetValue,
    peerValues.filter((v): v is number => v !== null && v > 0),
    ctx.minPeers,
  );
  if (!dist.ok) return unavailable(ctx, checkId, base, dist.reason);
  if (dist.value.targetVsMedianPct === null) return unavailable(ctx, checkId, base, 'peer median is not positive');

  const medianItem = item(ctx, checkId, { ...base, metric: `peer_median_${field}`, unit: 'ratio', value: dist.value.median, calculationVersion: CALCULATION_VERSION, note: `n=${dist.value.n}` });
  const targetItem = item(ctx, checkId, { ...base, metric: `target_${field}_for_peer_comparison`, unit: 'ratio', value: targetValue, sourceLocator: target.sourceLocator, retrievalTime: target.retrievedAt });
  return [
    medianItem,
    targetItem,
    item(ctx, checkId, {
      ...base,
      value: Math.round(dist.value.targetVsMedianPct * 100) / 100,
      derivedFrom: [targetItem.id, medianItem.id],
      calculationVersion: CALCULATION_VERSION,
      note: `peers: ${set.included.map((p) => p.ticker).join(', ')}`,
    }),
  ];
}

/**
 * Yield change and dividend-per-share change over the latest two completed fiscal years present
 * in both series. The retrieval year is excluded because Sectors reports it as a partial year.
 */
async function dividendChange(
  ctx: BuildContext,
  checkId: string,
  metric: 'yield_change_pct' | 'dps_change_pct',
): Promise<EvidenceItem[]> {
  const d = await dividends(ctx);
  const base = { metric, unit: 'percent' as const, sourceLocator: d.sourceLocator, retrievalTime: d.retrievedAt };
  const currentYear = Number(d.retrievedAt.slice(0, 4));
  const dpsByYear = new Map<number, number>();
  for (const p of d.payments) {
    const y = Number(p.date.slice(0, 4));
    dpsByYear.set(y, (dpsByYear.get(y) ?? 0) + p.amountPerShare);
  }
  const yieldOf = (y: number) => d.annualYieldsPct.find((x) => x.year === y)?.yieldPct;
  const years = d.annualYieldsPct
    .map((y) => y.year)
    .filter((y) => y < currentYear && dpsByYear.has(y) && dpsByYear.has(y - 1) && yieldOf(y - 1) !== undefined);
  if (!years.length) {
    return unavailable(ctx, checkId, base, 'no two consecutive completed years with both yield and dividend data');
  }
  const latest = Math.max(...years);
  const [cur, prev] =
    metric === 'yield_change_pct' ? [yieldOf(latest)!, yieldOf(latest - 1)!] : [dpsByYear.get(latest)!, dpsByYear.get(latest - 1)!];
  const growth = yoyGrowthPct(cur, prev);
  const where = { economicPeriod: `FY${latest}`, comparisonPeriod: `FY${latest - 1}` };
  if (!growth.ok) return [item(ctx, checkId, { ...base, ...where, status: 'INVALID', note: growth.reason })];
  return [
    item(ctx, checkId, { ...base, ...where, value: Math.round(growth.value * 100) / 100, calculationVersion: CALCULATION_VERSION }),
  ];
}
