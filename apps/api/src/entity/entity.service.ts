import { Inject, Injectable } from '@nestjs/common';
import type { ResolutionStatus } from '@counterpoint/domain';
import type { SectorsDataSource } from '@counterpoint/sectors';
import { SECTORS_SOURCE } from '../sectors/sectors.module';

export interface ResolvedEntity {
  mention: string;
  ticker: string | null;
  canonicalName: string | null;
  resolutionStatus: ResolutionStatus;
  candidates: { ticker: string; name: string }[];
}

const NON_TICKERS = new Set(['PE', 'PER', 'PBV', 'ROE', 'ROA', 'EPS', 'YOY', 'QOQ', 'IDX', 'TTM', 'IHSG', 'NIM', 'NPL', 'CEO', 'IPO', 'USD', 'IDR']);

/**
 * Deterministic resolution first (ticker/alias lookup); the LLM only proposes mentions.
 * Ambiguous mentions are never silently guessed (PRD section 14).
 */
@Injectable()
export class EntityService {
  constructor(@Inject(SECTORS_SOURCE) private readonly source: SectorsDataSource) {}

  candidateMentions(thesis: string, llmMentions: string[]): string[] {
    const tokens = thesis.match(/\b[A-Z]{3,5}\b/g) ?? [];
    const all = [...llmMentions, ...tokens.filter((t) => !NON_TICKERS.has(t))];
    return [...new Map(all.map((m) => [m.trim().toUpperCase(), m.trim()])).values()].filter(Boolean);
  }

  async resolve(mention: string): Promise<ResolvedEntity> {
    const hits = await this.source.searchCompanies(mention);
    const exact = hits.find((h) => h.ticker === mention.toUpperCase());
    if (exact) return { mention, ticker: exact.ticker, canonicalName: exact.name, resolutionStatus: 'RESOLVED', candidates: [exact] };
    if (hits.length === 1) {
      return { mention, ticker: hits[0]!.ticker, canonicalName: hits[0]!.name, resolutionStatus: 'RESOLVED', candidates: hits };
    }
    if (hits.length > 1) return { mention, ticker: null, canonicalName: null, resolutionStatus: 'AMBIGUOUS', candidates: hits.slice(0, 8) };
    return { mention, ticker: null, canonicalName: null, resolutionStatus: 'UNKNOWN', candidates: [] };
  }

  async resolveAll(thesis: string, llmMentions: string[]): Promise<ResolvedEntity[]> {
    const mentions = this.candidateMentions(thesis, llmMentions);
    const resolved = await Promise.all(mentions.map((m) => this.resolve(m)));
    const seen = new Set<string>();
    return resolved.filter((r) => {
      if (r.resolutionStatus === 'UNKNOWN' && !llmMentions.includes(r.mention)) return false;
      if (!r.ticker) return true;
      if (seen.has(r.ticker)) return false;
      seen.add(r.ticker);
      return true;
    });
  }
}
