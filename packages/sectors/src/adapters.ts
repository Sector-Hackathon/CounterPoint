import { z } from 'zod';
import type { Period } from '@counterpoint/domain';
import type { SectorsResponse } from './http';
import type {
  CompanyProfile,
  CompanySearchHit,
  DividendHistory,
  FinancialPeriodRecord,
  FinancialSeries,
  PeerCandidates,
  PriceRange,
  RatioSeries,
  ValuationSnapshot,
} from './types';

/**
 * Sectors API v2 endpoint paths and raw field names, verified against live responses on
 * 2026-09-27 (see docs/data-spike.md). Raw shapes never leave this module.
 */
export const ENDPOINTS = {
  companies: () => '/companies/',
  report: (ticker: string) => `/company/report/${ticker}/`,
  quarterly: (ticker: string) => `/financials/quarterly/${ticker}/`,
} as const;

/** Peer universe: the largest companies in the target's subsector, by market cap. */
export const PEER_UNIVERSE_LIMIT = 10;

/** Yield and payout fields are fractions (0.1098 = 10.98%). Verified in the data spike. */
export const RATIO_FIELDS_ARE_FRACTIONS = true;

const num = z.union([z.number(), z.string(), z.null()]).optional().transform((v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const RawScreener = z.object({
  results: z.array(z.object({ symbol: z.string(), company_name: z.string() }).passthrough()),
});

const RawDividendYear = z
  .object({
    total_yield: num,
    breakdown: z.array(z.object({ date: z.string(), total: num }).passthrough()).nullish(),
  })
  .passthrough();

const RawReport = z
  .object({
    symbol: z.string(),
    company_name: z.string().nullish(),
    overview: z
      .object({
        sector: z.string().nullish(),
        sub_sector: z.string().nullish(),
        last_close_price: num,
        latest_close_date: z.string().nullish(),
        all_time_price: z.record(z.string(), z.record(z.string(), num)).nullish(),
      })
      .passthrough()
      .nullish(),
    valuation: z
      .object({
        latest_close_date: z.string().nullish(),
        historical_valuation: z
          .array(z.object({ year: z.union([z.number(), z.string()]), pe: num, pb: num }).passthrough())
          .nullish(),
      })
      .passthrough()
      .nullish(),
    financials: z
      .object({
        historical_financials: z
          .array(z.object({ year: z.union([z.number(), z.string()]), revenue: num, earnings: num }).passthrough())
          .nullish(),
        historical_financial_ratio: z
          .array(
            z
              .object({
                year: z.union([z.number(), z.string()]),
                profitability: z.object({ roe: num }).passthrough().nullish(),
              })
              .passthrough(),
          )
          .nullish(),
      })
      .passthrough()
      .nullish(),
    dividend: z
      .object({
        historical_dividends: z.record(z.string(), RawDividendYear).nullish(),
        yield_ttm: num,
        payout_ratio: num,
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const RawQuarterly = z.array(z.object({ date: z.string(), revenue: num, earnings: num }).passthrough());

/** Thesis text is untrusted; only plain name characters may reach a `where` clause. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[^A-Za-z0-9 .&-]/g, '').trim().slice(0, 40);
}

export function searchQuery(term: string): Record<string, string> {
  const clean = sanitizeSearchTerm(term);
  const ticker = clean.toUpperCase();
  const where = /^[A-Z]{4}$/.test(ticker)
    ? `symbol = '${ticker}.JK' or company_name like '%${clean}%'`
    : `company_name like '%${clean}%'`;
  return { where, limit: '8' };
}

export function peerQuery(subsector: string): Record<string, string> {
  return {
    where: `sub_sector = '${sanitizeSearchTerm(subsector)}'`,
    order_by: '-market_cap',
    limit: String(PEER_UNIVERSE_LIMIT),
  };
}

export function adaptSearch(res: SectorsResponse): CompanySearchHit[] {
  return RawScreener.parse(res.data).results.map((c) => ({ ticker: normalizeTicker(c.symbol), name: c.company_name }));
}

export function adaptProfile(res: SectorsResponse): CompanyProfile {
  const r = RawReport.parse(res.data);
  return {
    ticker: normalizeTicker(r.symbol),
    name: r.company_name ?? r.symbol,
    sector: r.overview?.sector ?? null,
    subsector: r.overview?.sub_sector ?? null,
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function adaptQuarterly(res: SectorsResponse, ticker: string): FinancialSeries {
  const records: FinancialPeriodRecord[] = [];
  for (const row of RawQuarterly.parse(res.data)) {
    const period = quarterFromDate(row.date);
    if (!period) continue;
    records.push({ period, revenue: row.revenue, netIncome: row.earnings, eps: null });
  }
  return { ticker: normalizeTicker(ticker), records, sourceLocator: res.locator, retrievedAt: res.retrievedAt };
}

export function adaptAnnual(res: SectorsResponse): FinancialSeries {
  const r = RawReport.parse(res.data);
  const records: FinancialPeriodRecord[] = (r.financials?.historical_financials ?? []).map((row) => ({
    period: { kind: 'annual', year: Number(row.year) },
    revenue: row.revenue,
    netIncome: row.earnings,
    eps: null,
  }));
  return { ticker: normalizeTicker(r.symbol), records, sourceLocator: res.locator, retrievedAt: res.retrievedAt };
}

export function adaptDividends(res: SectorsResponse): DividendHistory {
  const r = RawReport.parse(res.data);
  const years = Object.entries(r.dividend?.historical_dividends ?? {})
    .map(([year, y]) => ({ year: Number(year), ...y }))
    .filter((y) => Number.isFinite(y.year));
  return {
    ticker: normalizeTicker(r.symbol),
    payments: years
      .flatMap((y) => y.breakdown ?? [])
      .filter((p): p is typeof p & { total: number } => p.total !== null)
      .map((p) => ({ date: p.date, amountPerShare: p.total }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    annualYieldsPct: years
      .filter((y) => y.total_yield !== null)
      .map((y) => ({ year: y.year, yieldPct: toPct(y.total_yield!) }))
      .sort((a, b) => a.year - b.year),
    trailingYieldPct: r.dividend?.yield_ttm == null ? null : toPct(r.dividend.yield_ttm),
    payoutRatioPct: r.dividend?.payout_ratio == null ? null : toPct(r.dividend.payout_ratio),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

/** Current P/E and P/BV: the latest-year entry of historical_valuation, as of the latest close. */
export function adaptValuation(res: SectorsResponse): ValuationSnapshot {
  const r = RawReport.parse(res.data);
  const latest = [...(r.valuation?.historical_valuation ?? [])].sort((a, b) => Number(b.year) - Number(a.year))[0];
  return {
    ticker: normalizeTicker(r.symbol),
    asOf: r.valuation?.latest_close_date ?? null,
    pe: latest?.pe ?? null,
    pbv: latest?.pb ?? null,
    dividendYieldPct: r.dividend?.yield_ttm == null ? null : toPct(r.dividend.yield_ttm),
    peHistory: (r.valuation?.historical_valuation ?? [])
      .filter((h): h is typeof h & { pe: number } => h.pe !== null)
      .map((h) => ({ year: Number(h.year), pe: h.pe }))
      .sort((a, b) => a.year - b.year),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

/** ROE per fiscal year from `financials.historical_financial_ratio` (fractions in the payload). */
export function adaptRatios(res: SectorsResponse): RatioSeries {
  const r = RawReport.parse(res.data);
  return {
    ticker: normalizeTicker(r.symbol),
    records: (r.financials?.historical_financial_ratio ?? [])
      .map((row) => ({ year: Number(row.year), roePct: row.profitability?.roe == null ? null : row.profitability.roe * 100 }))
      .filter((x) => Number.isFinite(x.year))
      .sort((a, b) => a.year - b.year),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

/** Last close and 52-week high from `overview` (`all_time_price["52_w_high"]` is `{ date: price }`). */
export function adaptPriceRange(res: SectorsResponse): PriceRange {
  const r = RawReport.parse(res.data);
  const high = Object.entries(r.overview?.all_time_price?.['52_w_high'] ?? {})[0];
  return {
    ticker: normalizeTicker(r.symbol),
    asOf: r.overview?.latest_close_date ?? null,
    lastClose: r.overview?.last_close_price ?? null,
    high52w: high?.[1] ?? null,
    high52wDate: high?.[0] ?? null,
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function adaptPeerCandidates(res: SectorsResponse, subsector: string): PeerCandidates {
  return {
    subsector,
    candidates: RawScreener.parse(res.data).results.map((c) => ({
      ticker: normalizeTicker(c.symbol),
      name: c.company_name,
      subsector,
    })),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function normalizeTicker(symbol: string): string {
  return symbol.toUpperCase().replace(/\.JK$/, '');
}

function toPct(v: number): number {
  return RATIO_FIELDS_ARE_FRACTIONS ? v * 100 : v;
}

function quarterFromDate(date: string): Period | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(date);
  if (!m) return null;
  const month = Number(m[2]);
  if (![3, 6, 9, 12].includes(month)) return null;
  return { kind: 'quarter', year: Number(m[1]), quarter: month / 3 };
}
