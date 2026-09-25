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
  ValuationSnapshot,
} from './types';

/**
 * Endpoint paths and raw field names. UNVERIFIED until the Sectors data spike (PRD section 26):
 * run `pnpm sectors:probe <TICKER>` and adjust this file only. Raw shapes never leave this module.
 */
export const ENDPOINTS = {
  search: () => '/companies/',
  report: (ticker: string) => `/company/report/${ticker}/`,
  quarterly: (ticker: string) => `/financials/quarterly/${ticker}/`,
  subsectorCompanies: () => '/companies/',
} as const;

const num = z.union([z.number(), z.string(), z.null()]).optional().transform((v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const RawCompanyList = z.array(
  z.object({ symbol: z.string(), company_name: z.string(), sub_sector: z.string().nullish() }).passthrough(),
);

const RawReport = z
  .object({
    symbol: z.string(),
    company_name: z.string().nullish(),
    overview: z.object({ sector: z.string().nullish(), sub_sector: z.string().nullish() }).passthrough().nullish(),
    valuation: z
      .object({
        pe: num,
        pb: num,
        pe_ttm: num,
        pb_mrq: num,
        date: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    financials: z
      .object({
        historical_financials: z
          .array(z.object({ year: z.number(), revenue: num, earnings: num, eps: num }).passthrough())
          .nullish(),
      })
      .passthrough()
      .nullish(),
    dividend: z
      .object({
        historical_dividends: z
          .array(
            z
              .object({
                year: z.number(),
                total_yield: num,
                breakdown: z.array(z.object({ date: z.string(), total: num }).passthrough()).nullish(),
              })
              .passthrough(),
          )
          .nullish(),
        yield_ttm: num,
        payout_ratio: num,
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const RawQuarterly = z.array(
  z.object({ date: z.string(), revenue: num, earnings: num, eps: num }).passthrough(),
);

export function adaptSearch(res: SectorsResponse, query: string): CompanySearchHit[] {
  const q = query.trim().toUpperCase();
  return RawCompanyList.parse(res.data)
    .map((c) => ({ ticker: normalizeTicker(c.symbol), name: c.company_name }))
    .filter((c) => c.ticker === q || c.name.toUpperCase().includes(q));
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
    records.push({ period, revenue: row.revenue, netIncome: row.earnings, eps: row.eps });
  }
  return { ticker: normalizeTicker(ticker), records, sourceLocator: res.locator, retrievedAt: res.retrievedAt };
}

export function adaptAnnual(res: SectorsResponse): FinancialSeries {
  const r = RawReport.parse(res.data);
  const records: FinancialPeriodRecord[] = (r.financials?.historical_financials ?? []).map((row) => ({
    period: { kind: 'annual', year: row.year },
    revenue: row.revenue,
    netIncome: row.earnings,
    eps: row.eps,
  }));
  return { ticker: normalizeTicker(r.symbol), records, sourceLocator: res.locator, retrievedAt: res.retrievedAt };
}

export function adaptDividends(res: SectorsResponse): DividendHistory {
  const r = RawReport.parse(res.data);
  const hist = r.dividend?.historical_dividends ?? [];
  return {
    ticker: normalizeTicker(r.symbol),
    payments: hist
      .flatMap((y) => y.breakdown ?? [])
      .filter((p): p is { date: string; total: number } => p.total !== null)
      .map((p) => ({ date: p.date, amountPerShare: p.total }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    annualYieldsPct: hist
      .filter((y) => y.total_yield !== null)
      .map((y) => ({ year: y.year, yieldPct: toPct(y.total_yield!) })),
    trailingYieldPct: r.dividend?.yield_ttm == null ? null : toPct(r.dividend.yield_ttm),
    payoutRatioPct: r.dividend?.payout_ratio == null ? null : toPct(r.dividend.payout_ratio),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function adaptValuation(res: SectorsResponse): ValuationSnapshot {
  const r = RawReport.parse(res.data);
  const v = r.valuation;
  return {
    ticker: normalizeTicker(r.symbol),
    asOf: v?.date ?? null,
    pe: v?.pe_ttm ?? v?.pe ?? null,
    pbv: v?.pb_mrq ?? v?.pb ?? null,
    dividendYieldPct: r.dividend?.yield_ttm == null ? null : toPct(r.dividend.yield_ttm),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function adaptPeerCandidates(res: SectorsResponse, subsector: string): PeerCandidates {
  return {
    subsector,
    candidates: RawCompanyList.parse(res.data).map((c) => ({
      ticker: normalizeTicker(c.symbol),
      name: c.company_name,
      subsector: c.sub_sector ?? subsector,
    })),
    sourceLocator: res.locator,
    retrievedAt: res.retrievedAt,
  };
}

export function normalizeTicker(symbol: string): string {
  return symbol.toUpperCase().replace(/\.JK$/, '');
}

/** Whether Sectors yield/payout fields are fractions (0.05) rather than percent (5). Confirm in the data spike. */
export const RATIO_FIELDS_ARE_FRACTIONS = true;

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
