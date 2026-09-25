/**
 * Data spike (PRD section 26): dumps raw Sectors payloads for a ticker so the adapter field
 * mapping in packages/sectors/src/adapters.ts can be verified against reality.
 *
 *   SECTORS_API_KEY=... pnpm sectors:probe BBRI
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ticker = (process.argv[2] ?? 'BBRI').toUpperCase();
const apiKey = process.env.SECTORS_API_KEY;
const base = (process.env.SECTORS_BASE_URL ?? 'https://api.sectors.app/v1').replace(/\/$/, '');
if (!apiKey) {
  console.error('SECTORS_API_KEY is not set');
  process.exit(1);
}

const probes: [string, string][] = [
  ['report-overview', `/company/report/${ticker}/?sections=overview`],
  ['report-financials', `/company/report/${ticker}/?sections=financials`],
  ['report-valuation', `/company/report/${ticker}/?sections=valuation`],
  ['report-dividend', `/company/report/${ticker}/?sections=dividend`],
  ['quarterly', `/financials/quarterly/${ticker}/?n_quarters=8`],
  ['subsector-companies', `/companies/?sub_sector=banks`],
];

const outDir = join(process.cwd(), 'docs', 'data-spike', ticker);
mkdirSync(outDir, { recursive: true });

async function main() {
  for (const [name, path] of probes) {
    const started = Date.now();
    const res = await fetch(`${base}${path}`, { headers: { Authorization: apiKey! } });
    const body = await res.text();
    writeFileSync(join(outDir, `${name}.json`), body);
    console.log(`${res.status} ${Date.now() - started}ms ${path} -> ${name}.json (${body.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
