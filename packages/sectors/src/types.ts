import type { Period } from '@counterpoint/domain';

/** Provenance attached to every normalized record. Economic period lives on the record itself. */
export interface Provenance {
  sourceLocator: string;
  retrievedAt: string;
}

export interface CompanyProfile extends Provenance {
  ticker: string;
  name: string;
  sector: string | null;
  subsector: string | null;
}

export interface FinancialPeriodRecord {
  period: Period;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
}

export interface FinancialSeries extends Provenance {
  ticker: string;
  records: FinancialPeriodRecord[];
}

export interface DividendPayment {
  date: string;
  amountPerShare: number;
}

export interface DividendHistory extends Provenance {
  ticker: string;
  payments: DividendPayment[];
  /** Annual yields by fiscal year, in percent. */
  annualYieldsPct: { year: number; yieldPct: number }[];
  trailingYieldPct: number | null;
  payoutRatioPct: number | null;
}

export interface ValuationSnapshot extends Provenance {
  ticker: string;
  /** Trading date the valuation refers to. */
  asOf: string | null;
  pe: number | null;
  pbv: number | null;
  dividendYieldPct: number | null;
  /** P/E per fiscal year, ascending; the latest year is the current snapshot. */
  peHistory: { year: number; pe: number }[];
}

export interface RatioSeries extends Provenance {
  ticker: string;
  /** ROE per fiscal year, ascending, in percent. */
  records: { year: number; roePct: number | null }[];
}

export interface PriceRange extends Provenance {
  ticker: string;
  asOf: string | null;
  lastClose: number | null;
  high52w: number | null;
  high52wDate: string | null;
}

export interface PeerCandidateRecord {
  ticker: string;
  name: string;
  subsector: string | null;
}

export interface PeerCandidates extends Provenance {
  subsector: string;
  candidates: PeerCandidateRecord[];
}

export interface CompanySearchHit {
  ticker: string;
  name: string;
}

/** Typed boundary for all Sectors data. Raw payloads never cross it. */
export interface SectorsDataSource {
  searchCompanies(query: string): Promise<CompanySearchHit[]>;
  getCompanyProfile(ticker: string): Promise<CompanyProfile | null>;
  getQuarterlyFinancials(ticker: string): Promise<FinancialSeries>;
  getAnnualFinancials(ticker: string): Promise<FinancialSeries>;
  getDividendHistory(ticker: string): Promise<DividendHistory>;
  getValuation(ticker: string): Promise<ValuationSnapshot>;
  getPeerCandidates(subsector: string): Promise<PeerCandidates>;
  getFinancialRatios(ticker: string): Promise<RatioSeries>;
  getPriceRange(ticker: string): Promise<PriceRange>;
}
