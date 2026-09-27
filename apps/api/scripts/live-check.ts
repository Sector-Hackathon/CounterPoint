/**
 * Runs claims end to end against LIVE Sectors data and prints the tool path, assessment and report.
 * Uses the configured LLM planner when a provider key is set, otherwise the deterministic planner.
 *
 *   pnpm --filter @counterpoint/api live-check BBRI:ABSOLUTE_GROWTH BBCA:RELATIVE_VALUATION
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ClaimType, type Claim } from '@counterpoint/domain';
import { createSectorsDataSource } from '@counterpoint/sectors';
import { DeterministicPlanner, investigateClaim } from '../src/investigation/engine';
import { LlmPlanner } from '../src/investigation/llm-planner';
import { composeClaimReport, validateClaimReport } from '../src/reports/composer';
import { LlmService } from '../src/llm/llm.service';
import { ClaimsService } from '../src/claims/claims.service';

const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  let calls = 0;
  const { source, mode } = createSectorsDataSource({
    apiKey: process.env.SECTORS_API_KEY,
    baseUrl: process.env.SECTORS_BASE_URL,
    onCall: (e) => { if (!e.cacheHit) calls++; },
  });
  if (mode !== 'live') throw new Error('SECTORS_API_KEY is not set; live-check needs live data');
  const llm = new LlmService();
  const planner = llm.available ? new LlmPlanner(llm) : new DeterministicPlanner();
  const claims = new ClaimsService(llm);
  const specs = process.argv.slice(2).length ? process.argv.slice(2) : ['BBRI:ABSOLUTE_GROWTH', 'BBCA:ABSOLUTE_GROWTH', 'BBRI:DIVIDEND_LEVEL', 'BBRI:RELATIVE_VALUATION'];

  for (const spec of specs) {
    const [ticker, type] = spec.split(':');
    const claimType = ClaimType.parse(type);
    const claim: Claim = {
      id: randomUUID(), sessionId: 'live-check', originalText: spec, normalizedText: spec, ticker: ticker!.toUpperCase(),
      claimType, comparisonType: 'ABSOLUTE', timeScope: null, assessment: null,
      ...claims.toContract(claimType, 'YES', null),
    };
    const started = Date.now();
    const r = await investigateClaim(claim, { source, planner, newId: randomUUID });
    const { report, issues } = validateClaimReport(composeClaimReport({ claim, ...r }), r.evidence);

    console.log(`\n=== ${spec} — ${r.assessment} (${r.coverage?.label ?? 'no contract'}), stop ${r.stopReason}, ${Date.now() - started}ms, planner ${planner.name}`);
    for (const t of r.trace) console.log(`  ${String(t.sequence).padStart(2)} ${t.action.padEnd(24)} ${t.resultStatus.padEnd(8)} ${t.reason}`);
    for (const [k, list] of [['supports', report.supports], ['weakens', report.weakens], ['context', report.context]] as const) {
      for (const s of list) console.log(`  ${k}: ${s.text}`);
    }
    for (const m of report.missing) console.log(`  missing: ${m}`);
    if (report.peerSet) console.log(`  peers: ${report.peerSet.included.join(', ')} | excluded: ${report.peerSet.excluded.map((e) => `${e.ticker} (${e.reason})`).join('; ')}`);
    if (issues.length) console.log(`  VALIDATION ISSUES: ${issues.map((i) => `${i.kind}:${i.detail}`).join(', ')}`);
  }
  console.log(`\nSectors HTTP calls (uncached): ${calls}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
