import {
  ENDPOINTS,
  adaptAnnual,
  adaptDividends,
  adaptPeerCandidates,
  adaptProfile,
  adaptQuarterly,
  adaptSearch,
  adaptValuation,
  peerQuery,
  sanitizeSearchTerm,
  searchQuery,
} from './adapters';
import { SectorsHttpClient, SectorsHttpError } from './http';
import type { SectorsDataSource } from './types';

export class HttpSectorsDataSource implements SectorsDataSource {
  constructor(private readonly http: SectorsHttpClient) {}

  async searchCompanies(query: string) {
    if (sanitizeSearchTerm(query).length < 2) return [];
    return adaptSearch(await this.http.get(ENDPOINTS.companies(), searchQuery(query)));
  }

  async getCompanyProfile(ticker: string) {
    try {
      return adaptProfile(await this.http.get(ENDPOINTS.report(ticker), { sections: 'overview' }));
    } catch (err) {
      if (err instanceof SectorsHttpError && err.status === 404) return null;
      throw err;
    }
  }

  async getQuarterlyFinancials(ticker: string) {
    return adaptQuarterly(await this.http.get(ENDPOINTS.quarterly(ticker), { n_quarters: '8' }), ticker);
  }

  async getAnnualFinancials(ticker: string) {
    return adaptAnnual(await this.http.get(ENDPOINTS.report(ticker), { sections: 'financials' }));
  }

  async getDividendHistory(ticker: string) {
    return adaptDividends(await this.http.get(ENDPOINTS.report(ticker), { sections: 'dividend' }));
  }

  async getValuation(ticker: string) {
    return adaptValuation(await this.http.get(ENDPOINTS.report(ticker), { sections: 'valuation,dividend' }));
  }

  async getPeerCandidates(subsector: string) {
    return adaptPeerCandidates(await this.http.get(ENDPOINTS.companies(), peerQuery(subsector)), subsector);
  }
}
