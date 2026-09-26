import { parsePeriodKey } from '@counterpoint/domain';
import type {
  CompanyProfile,
  DividendHistory,
  FinancialSeries,
  SectorsDataSource,
  ValuationSnapshot,
} from './types';

export interface FixtureSet {
  retrievedAt: string;
  companies: { ticker: string; name: string; aliases?: string[]; sector: string; subsector: string }[];
  quarterly: Record<string, { period: string; revenue: number | null; netIncome: number | null; eps?: number | null }[]>;
  annual: Record<string, { year: number; revenue: number | null; netIncome: number | null }[]>;
  dividends: Record<string, Omit<DividendHistory, 'ticker' | 'sourceLocator' | 'retrievedAt'>>;
  valuation: Record<string, Omit<ValuationSnapshot, 'ticker' | 'sourceLocator' | 'retrievedAt'>>;
}

/**
 * Offline data source for development, tests and eval replay. Every locator is prefixed
 * `fixture:` so fixture evidence can never be presented as live Sectors data.
 */
export class FixtureSectorsDataSource implements SectorsDataSource {
  constructor(private readonly fx: FixtureSet) {}

  private loc(path: string) {
    return { sourceLocator: `fixture:${path}`, retrievedAt: this.fx.retrievedAt };
  }

  async searchCompanies(query: string) {
    const q = query.trim().toUpperCase();
    return this.fx.companies
      .filter(
        (c) =>
          c.ticker === q ||
          c.name.toUpperCase().includes(q) ||
          (c.aliases ?? []).some((a) => a.toUpperCase() === q),
      )
      .map((c) => ({ ticker: c.ticker, name: c.name }));
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
    const c = this.fx.companies.find((x) => x.ticker === ticker);
    if (!c) return null;
    return { ticker, name: c.name, sector: c.sector, subsector: c.subsector, ...this.loc(`profile/${ticker}`) };
  }

  async getQuarterlyFinancials(ticker: string): Promise<FinancialSeries> {
    return {
      ticker,
      records: (this.fx.quarterly[ticker] ?? []).flatMap((r) => {
        const period = parsePeriodKey(r.period);
        return period ? [{ period, revenue: r.revenue, netIncome: r.netIncome, eps: r.eps ?? null }] : [];
      }),
      ...this.loc(`quarterly/${ticker}`),
    };
  }

  async getAnnualFinancials(ticker: string): Promise<FinancialSeries> {
    return {
      ticker,
      records: (this.fx.annual[ticker] ?? []).map((r) => ({
        period: { kind: 'annual' as const, year: r.year },
        revenue: r.revenue,
        netIncome: r.netIncome,
        eps: null,
      })),
      ...this.loc(`annual/${ticker}`),
    };
  }

  async getDividendHistory(ticker: string): Promise<DividendHistory> {
    const d = this.fx.dividends[ticker] ?? {
      payments: [],
      annualYieldsPct: [],
      trailingYieldPct: null,
      payoutRatioPct: null,
    };
    return { ticker, ...d, ...this.loc(`dividends/${ticker}`) };
  }

  async getValuation(ticker: string): Promise<ValuationSnapshot> {
    const v = this.fx.valuation[ticker] ?? { asOf: null, pe: null, pbv: null, dividendYieldPct: null };
    return { ticker, ...v, ...this.loc(`valuation/${ticker}`) };
  }

  async getPeerCandidates(subsector: string) {
    return {
      subsector,
      candidates: this.fx.companies
        .filter((c) => c.subsector === subsector)
        .map((c) => ({ ticker: c.ticker, name: c.name, subsector: c.subsector })),
      ...this.loc(`peers/${subsector}`),
    };
  }
}

const bank = (ticker: string, name: string, aliases: string[] = []) => ({
  ticker,
  name,
  aliases,
  sector: 'Financials',
  subsector: 'Banks',
});

/** Synthetic development data. Numbers are illustrative only and are NOT real company financials. */
export const DEV_FIXTURE: FixtureSet = {
  retrievedAt: '2026-09-25T00:00:00.000Z',
  companies: [
    bank('BBRI', 'PT Bank Rakyat Indonesia (Persero) Tbk', ['BRI', 'Bank BRI']),
    bank('BMRI', 'PT Bank Mandiri (Persero) Tbk', ['Mandiri', 'Bank Mandiri']),
    bank('BBCA', 'PT Bank Central Asia Tbk', ['BCA', 'Bank BCA']),
    bank('BBNI', 'PT Bank Negara Indonesia (Persero) Tbk', ['BNI', 'Bank BNI']),
    bank('BRIS', 'PT Bank Syariah Indonesia Tbk', ['BSI']),
    { ticker: 'TLKM', name: 'PT Telkom Indonesia (Persero) Tbk', aliases: ['Telkom'], sector: 'Infrastructure', subsector: 'Telecommunication' },
  ],
  quarterly: {
    // Revenue accelerates while earnings lag: exercises the divergence -> margin follow-up branch.
    BBRI: [
      { period: '2024Q1', revenue: 48_000, netIncome: 15_500 },
      { period: '2024Q2', revenue: 49_000, netIncome: 15_300 },
      { period: '2025Q1', revenue: 54_200, netIncome: 13_800 },
      { period: '2025Q2', revenue: 56_400, netIncome: 13_600 },
    ],
    // Steady, consistent growth: no contradiction, no follow-up branch.
    BBCA: [
      { period: '2024Q1', revenue: 27_000, netIncome: 12_900 },
      { period: '2024Q2', revenue: 27_800, netIncome: 13_400 },
      { period: '2025Q1', revenue: 30_000, netIncome: 14_300 },
      { period: '2025Q2', revenue: 30_900, netIncome: 14_900 },
    ],
  },
  annual: {
    BBRI: [
      { year: 2023, revenue: 185_000, netIncome: 60_400 },
      { year: 2024, revenue: 200_000, netIncome: 60_100 },
    ],
    BBCA: [
      { year: 2023, revenue: 105_000, netIncome: 48_600 },
      { year: 2024, revenue: 114_000, netIncome: 54_800 },
    ],
  },
  dividends: {
    BBRI: {
      payments: [
        { date: '2024-03-28', amountPerShare: 288 },
        { date: '2025-04-10', amountPerShare: 319 },
        { date: '2026-04-09', amountPerShare: 343 },
      ],
      annualYieldsPct: [
        { year: 2022, yieldPct: 5.2 },
        { year: 2023, yieldPct: 5.6 },
        { year: 2024, yieldPct: 7.4 },
      ],
      trailingYieldPct: 8.1,
      payoutRatioPct: 85,
    },
  },
  valuation: {
    BBRI: { asOf: '2026-09-24', pe: 9.2, pbv: 1.9, dividendYieldPct: 8.1 },
    BMRI: { asOf: '2026-09-24', pe: 8.4, pbv: 1.5, dividendYieldPct: 7.9 },
    BBCA: { asOf: '2026-09-24', pe: 21.5, pbv: 4.2, dividendYieldPct: 3.1 },
    BBNI: { asOf: '2026-09-24', pe: 7.1, pbv: 0.9, dividendYieldPct: 6.8 },
    BRIS: { asOf: '2026-09-24', pe: 15.8, pbv: 2.4, dividendYieldPct: 1.2 },
  },
};
