/** One listed company as the index build gathered it: Sectors' name, plus Wikidata's aliases and websites. */
export interface CompanyRecord {
  ticker: string;
  name: string;
  aliases?: string[];
  websites?: string[];
}

export interface CompanyHit {
  ticker: string;
  name: string;
}

/** Domain labels that never name the company itself. */
const DOMAIN_SUFFIXES = new Set(['www', 'co', 'id', 'com', 'net', 'org', 'or', 'ac', 'go', 'biz', 'info', 'web', 'tbk']);

/** Hosts left by malformed website entries ("http://http//..."). */
const NOT_BRANDS = new Set(['http', 'https']);

/**
 * Company names that are also everyday words and often start a sentence. The text scan skips
 * them; a mention the model reports is still matched.
 */
const EVERYDAY_WORDS = new Set([
  'mari', 'jago', 'bull', 'smart', 'hits', 'tempo', 'viva', 'garam', 'cahaya', 'sentral', 'hero',
  'tugu', 'sekar', 'mentari', 'radiant', 'limas', 'argo', 'surya', 'toto', 'kino',
]);

/** A comparable form of a company name: lower case, no punctuation, no "PT", "Tbk" or "(Persero)". */
export function nameKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\bpersero\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^pt /, '')
    .replace(/ tbk$/, '')
    .trim();
}

/** The brand in a company's website domain ("https://alfamart.co.id" → "alfamart"), if it is long enough to mean anything. */
export function brandFromWebsite(website: string): string | null {
  let host: string;
  try {
    host = new URL(website.includes('://') ? website : `http://${website}`).hostname;
  } catch {
    return null;
  }
  const labels = host.toLowerCase().split('.');
  while (labels.length && DOMAIN_SUFFIXES.has(labels[labels.length - 1]!)) labels.pop();
  const brand = labels.pop()?.replace(/-/g, ' ').trim();
  return brand && brand.replace(/ /g, '').length >= 3 && !NOT_BRANDS.has(brand) ? brand : null;
}

/**
 * Every listed company with the names people use for it, matched locally so that resolving
 * a mention costs no Sectors credits. An exact name or alias wins; otherwise any company whose
 * name contains the mention as whole words is a match.
 */
export class CompanyIndex {
  private readonly companies = new Map<string, CompanyHit>();
  private readonly keysByTicker = new Map<string, string[]>();
  private readonly exact = new Map<string, Set<string>>();

  constructor(records: CompanyRecord[], extraAliases: Record<string, string[]> = {}) {
    for (const r of records) {
      const ticker = r.ticker.toUpperCase();
      this.companies.set(ticker, { ticker, name: r.name });
      const brands = (r.websites ?? []).map(brandFromWebsite).filter((b): b is string => b !== null);
      const names = [r.name, ...(r.aliases ?? []), ...brands, ...(extraAliases[ticker] ?? [])];
      const keys = [...new Set(names.map(nameKey).filter(Boolean))];
      this.keysByTicker.set(ticker, keys);
      for (const key of keys) for (const form of [key, key.replace(/ /g, '')]) {
        const set = this.exact.get(form) ?? new Set<string>();
        set.add(ticker);
        this.exact.set(form, set);
      }
    }
  }

  get size(): number {
    return this.companies.size;
  }

  byTicker(ticker: string): CompanyHit | null {
    return this.companies.get(ticker.trim().toUpperCase().replace(/\.JK$/, '')) ?? null;
  }

  /**
   * Company names written in free text: capitalised runs of up to four words that exactly match
   * a name or alias of at least four letters, longest first. For when no mention was extracted.
   */
  scan(text: string): { mention: string; hits: CompanyHit[] }[] {
    const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
    const found: { mention: string; hits: CompanyHit[] }[] = [];
    for (let i = 0; i < words.length; ) {
      let used = 1;
      if (/^\p{Lu}/u.test(words[i]![0])) {
        for (let n = Math.min(4, words.length - i); n >= 1; n--) {
          const last = words[i + n - 1]!;
          const mention = text.slice(words[i]!.index, last.index + last[0].length);
          const key = nameKey(mention);
          if (key.replace(/ /g, '').length < 4 || EVERYDAY_WORDS.has(key)) continue;
          const tickers = this.exact.get(key) ?? this.exact.get(key.replace(/ /g, ''));
          if (!tickers) continue;
          found.push({ mention, hits: [...tickers].map((t) => this.companies.get(t)!) });
          used = n;
          break;
        }
      }
      i += used;
    }
    return found;
  }

  find(mention: string): CompanyHit[] {
    const key = nameKey(mention);
    if (!key) return [];
    const exact = this.exact.get(key) ?? this.exact.get(key.replace(/ /g, ''));
    if (exact) return [...exact].map((t) => this.companies.get(t)!);
    if (key.length < 4) return [];
    const hits: CompanyHit[] = [];
    for (const [ticker, keys] of this.keysByTicker) {
      if (keys.some((k) => ` ${k} `.includes(` ${key} `))) hits.push(this.companies.get(ticker)!);
    }
    return hits;
  }
}
