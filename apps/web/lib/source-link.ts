/**
 * Maps a Sectors API locator (`sectors:/…`) to the public sectors.app page showing the same data.
 * API paths need a private key, so the evidence drawer links here instead. URL patterns were read
 * off sectors.app on 2026-10-08:
 * - company page: /idx/{ticker, lowercase}, with sections #overview #valuation #peers #financials #dividend
 * - subsector page: /indonesia/{slug}, slug = lowercase name, `&` and `,` dropped, spaces → hyphens
 * `fixture:` sample data has no public page and gets no link.
 */
export type SourceLink = { href: string; kind: 'company' | 'subsector'; subject: string };

const BASE = 'https://sectors.app';
const COMPANY_SECTIONS = new Set(['overview', 'valuation', 'peers', 'financials', 'dividend']);

/** Every subsector page listed in the sectors.app sitemap on 2026-10-08. */
const SUBSECTOR_SLUGS = new Set([
  'alternative-energy', 'apparel-luxury-goods', 'automobiles-components', 'banks', 'basic-materials',
  'consumer-services', 'financing-service', 'food-beverage', 'food-staples-retailing',
  'healthcare-equipment-providers', 'heavy-constructions-civil-engineering', 'holding-investment-companies',
  'household-goods', 'industrial-goods', 'industrial-services', 'insurance', 'investment-service',
  'leisure-goods', 'logistics-deliveries', 'media-entertainment', 'multi-sector-holdings',
  'nondurable-household-products', 'oil-gas-coal', 'pharmaceuticals-health-care-research',
  'properties-real-estate', 'retailing', 'software-it-services', 'technology-hardware-equipment',
  'telecommunication', 'tobacco', 'transportation', 'transportation-infrastructure', 'utilities',
]);

export function subsectorSlug(name: string): string {
  return name.toLowerCase().replace(/[&,]/g, ' ').trim().replace(/\s+/g, '-');
}

function companyPage(ticker: string, section?: string): SourceLink {
  const subject = ticker.toUpperCase().replace(/\.JK$/, '');
  const anchor = section && COMPANY_SECTIONS.has(section) ? `#${section}` : '';
  return { href: `${BASE}/idx/${subject.toLowerCase()}${anchor}`, kind: 'company', subject };
}

export function sourceLink(locator: string): SourceLink | null {
  if (!locator.startsWith('sectors:/')) return null;
  let url: URL;
  try {
    url = new URL(locator.slice('sectors:'.length), BASE);
  } catch {
    return null;
  }

  const report = url.pathname.match(/^\/company\/report\/([^/]+)\/?$/);
  if (report) return companyPage(report[1]!, url.searchParams.get('sections')?.split(',')[0]?.trim());

  const quarterly = url.pathname.match(/^\/financials\/quarterly\/([^/]+)\/?$/);
  if (quarterly) return companyPage(quarterly[1]!, 'financials');

  if (/^\/companies\/?$/.test(url.pathname)) {
    const subsector = url.searchParams.get('where')?.match(/sub_sector\s*=\s*'([^']+)'/)?.[1];
    if (!subsector) return null;
    const slug = subsectorSlug(subsector);
    const href = SUBSECTOR_SLUGS.has(slug) ? `${BASE}/indonesia/${slug}` : `${BASE}/indonesia/economic-sectors`;
    return { href, kind: 'subsector', subject: subsector };
  }

  return null;
}
