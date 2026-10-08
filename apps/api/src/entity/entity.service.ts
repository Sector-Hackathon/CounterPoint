import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ResolutionStatus } from '@counterpoint/domain';
import type { SectorsDataSource } from '@counterpoint/sectors';
import { SECTORS_SOURCE } from '../sectors/sectors.module';
import { CompanyIndex } from './company-index';
import { defaultCompanyIndex } from './company-index.default';

/** Optional provider for a custom index; the committed one is used otherwise. */
export const COMPANY_INDEX = 'COMPANY_INDEX';

export interface ResolvedEntity {
  mention: string;
  ticker: string | null;
  canonicalName: string | null;
  resolutionStatus: ResolutionStatus;
  candidates: { ticker: string; name: string }[];
}

/** What the extractor reports per company: the mention as written, and its own ticker guess. */
export interface MentionGuess {
  mention: string;
  ticker_guess: string | null;
}

/**
 * The search term for a mention, without the legal form. Listings spell it inconsistently
 * ("PT X Tbk" vs "PT. X Tbk."), and a substring search fails on a single stray period.
 */
export function searchTerm(mention: string): string {
  const core = mention
    .replace(/\(persero\)/gi, ' ')
    .replace(/^\s*PT\.?\s+/i, '')
    .replace(/\s+Tbk\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,]+$/, '')
    .trim();
  return core || mention.trim();
}

const NON_TICKERS = new Set(['PE', 'PER', 'PBV', 'ROE', 'ROA', 'EPS', 'YOY', 'QOQ', 'IDX', 'TTM', 'IHSG', 'NIM', 'NPL', 'CEO', 'IPO', 'USD', 'IDR']);

/**
 * Deterministic resolution first (ticker/alias lookup); the LLM only proposes mentions.
 * Ambiguous mentions are never silently guessed (PRD section 14).
 */
@Injectable()
export class EntityService {
  private readonly index: CompanyIndex;

  constructor(
    @Inject(SECTORS_SOURCE) private readonly source: SectorsDataSource,
    @Optional() @Inject(COMPANY_INDEX) index?: CompanyIndex,
  ) {
    this.index = index ?? defaultCompanyIndex();
  }

  candidateMentions(thesis: string, llmMentions: string[]): string[] {
    const tokens = thesis.match(/\b[A-Z]{3,5}\b/g) ?? [];
    const all = [...llmMentions, ...tokens.filter((t) => !NON_TICKERS.has(t))];
    return [...new Map(all.map((m) => [m.trim().toUpperCase(), m.trim()])).values()].filter(Boolean);
  }

  /**
   * The local company index first, then the Sectors name search for companies it lacks. The
   * model's ticker guess only ever becomes a candidate to confirm, and only for a listed ticker.
   */
  async resolve(mention: string, guess?: string | null): Promise<ResolvedEntity> {
    const listed = this.index.byTicker(mention);
    if (listed && /^[A-Za-z]{4}$/.test(mention.trim())) {
      return { mention, ticker: listed.ticker, canonicalName: listed.name, resolutionStatus: 'RESOLVED', candidates: [listed] };
    }
    const known = this.index.find(mention);
    const hits = known.length ? known : await this.source.searchCompanies(searchTerm(mention));
    const exact = hits.find((h) => h.ticker === mention.toUpperCase());
    if (exact) return { mention, ticker: exact.ticker, canonicalName: exact.name, resolutionStatus: 'RESOLVED', candidates: [exact] };
    if (hits.length === 1) {
      return { mention, ticker: hits[0]!.ticker, canonicalName: hits[0]!.name, resolutionStatus: 'RESOLVED', candidates: hits };
    }
    const guessed = await this.listedTicker(guess);
    const candidates = guessed ? [guessed, ...hits.filter((h) => h.ticker !== guessed.ticker)] : hits;
    if (candidates.length > 0) return { mention, ticker: null, canonicalName: null, resolutionStatus: 'AMBIGUOUS', candidates: candidates.slice(0, 8) };
    return { mention, ticker: null, canonicalName: null, resolutionStatus: 'UNKNOWN', candidates: [] };
  }

  private async listedTicker(guess?: string | null) {
    const ticker = guess?.trim().toUpperCase().replace(/\.JK$/, '');
    if (!ticker || !/^[A-Z]{4}$/.test(ticker)) return null;
    return this.index.byTicker(ticker) ?? (await this.source.searchCompanies(ticker)).find((h) => h.ticker === ticker) ?? null;
  }

  async resolveAll(thesis: string, llmEntities: MentionGuess[]): Promise<ResolvedEntity[]> {
    const llmMentions = llmEntities.map((e) => e.mention);
    const guessFor = (m: string) => llmEntities.find((e) => e.mention.trim().toUpperCase() === m.toUpperCase())?.ticker_guess;
    const isLlmMention = (m: string) => llmMentions.some((l) => l.trim().toUpperCase() === m.toUpperCase());
    // A capitalised word only counts as a ticker if it is listed; with no index, Sectors decides.
    const mentions = this.candidateMentions(thesis, llmMentions).filter(
      (m) => isLlmMention(m) || this.index.size === 0 || this.index.byTicker(m) !== null,
    );
    const resolved = await Promise.all(mentions.map((m) => this.resolve(m, guessFor(m))));
    const seen = new Set<string>();
    const kept = resolved.filter((r) => {
      if (r.resolutionStatus === 'UNKNOWN' && !llmMentions.includes(r.mention)) return false;
      if (!r.ticker) return true;
      if (seen.has(r.ticker)) return false;
      seen.add(r.ticker);
      return true;
    });
    if (kept.some((r) => r.ticker || r.candidates.length)) return kept;
    // The model named no company we can find: offer names spotted in the text, to be confirmed.
    const spotted = this.index.scan(thesis).map((m): ResolvedEntity => ({
      mention: m.mention, ticker: null, canonicalName: null, resolutionStatus: 'AMBIGUOUS', candidates: m.hits.slice(0, 8),
    }));
    return [...kept, ...spotted];
  }
}
