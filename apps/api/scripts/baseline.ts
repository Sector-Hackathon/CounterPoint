/**
 * Generic-LLM baseline (PRD section 21.1): the same thesis plus the same Sectors data bundle,
 * given to a plain prompt. Counts numbers in the answer that do not appear in the bundle and
 * advice or causal language. Qualitative comparison only; report measured results as such.
 *
 *   pnpm --filter @counterpoint/api baseline "<thesis>" <TICKER> <name>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod/v4';
import { extractNumbers, guardLanguage } from '@counterpoint/domain';
import { DEV_FIXTURE, FixtureSectorsDataSource, HttpSectorsDataSource, SectorsHttpClient } from '@counterpoint/sectors';
import { LlmService } from '../src/llm/llm.service';

const [thesis, ticker, name] = process.argv.slice(2);
if (!thesis || !ticker || !name) {
  console.error('usage: baseline "<thesis>" <TICKER> <name>');
  process.exit(1);
}

async function main() {
  const live = Boolean(process.env.SECTORS_API_KEY);
  const source = live
    ? new HttpSectorsDataSource(new SectorsHttpClient({ apiKey: process.env.SECTORS_API_KEY!, baseUrl: process.env.SECTORS_BASE_URL }))
    : new FixtureSectorsDataSource(DEV_FIXTURE);
  const bundle = {
    quarterly: await source.getQuarterlyFinancials(ticker!),
    annual: await source.getAnnualFinancials(ticker!),
    dividends: await source.getDividendHistory(ticker!),
    valuation: await source.getValuation(ticker!),
  };
  const llm = new LlmService();
  const out = await llm.parse(z.object({ answer: z.string() }), {
    system: 'You are a helpful assistant.',
    user: `Here is company data:\n${JSON.stringify(bundle)}\n\nIs this stock thesis right? "${thesis}"`,
    label: 'baseline',
  });

  // Any number literally present in the bundle (to one decimal) counts as traceable.
  const bundleNumbers = new Set((JSON.stringify(bundle).match(/-?\d+(?:\.\d+)?/g) ?? []).map((n) => Number(n).toFixed(1)));
  const numbers = extractNumbers(out.answer);
  const untraceable = numbers.filter((n) => !bundleNumbers.has(n.value.toFixed(1)));
  const issues = guardLanguage(out.answer);

  const dir = resolve(process.cwd(), '..', '..', 'evals', 'baseline');
  mkdirSync(dir, { recursive: true });
  const result = {
    thesis,
    ticker,
    model: llm.model,
    dataMode: live ? 'live' : 'fixture',
    measuredAt: new Date().toISOString(),
    answer: out.answer,
    numbers: numbers.length,
    untraceable: untraceable.map((n) => n.raw),
    languageIssues: issues.map((i) => `${i.kind}: ${i.detail}`),
  };
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(`${name}: ${numbers.length} numbers, ${untraceable.length} not in the data bundle, ${issues.length} advice/causal issues`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
