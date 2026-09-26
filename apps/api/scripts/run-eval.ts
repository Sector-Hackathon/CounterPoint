/**
 * Reproducible evaluation harness (PRD section 21).
 *
 *   pnpm eval                  claim-level cases on the labelled fixture, deterministic planner
 *   pnpm eval --llm-planner    same cases, Claude planner (needs ANTHROPIC_API_KEY)
 *   pnpm eval --theses         thesis decomposition cases (Claude if configured, else heuristic)
 *
 * Reports measured results only. Results are written to evals/results/ (git-ignored).
 */
import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Claim } from '@counterpoint/domain';
import { DEV_FIXTURE, FixtureSectorsDataSource } from '@counterpoint/sectors';
import { ClaimCase, ThesisCase, scoreClaimCase, scoreThesisCase, summarize, type CaseScore } from '@counterpoint/eval';
import { DeterministicPlanner, investigateClaim, type Planner } from '../src/investigation/engine';
import { LlmPlanner } from '../src/investigation/llm-planner';
import { composeClaimReport, validateClaimReport } from '../src/reports/composer';
import { LlmService } from '../src/llm/llm.service';
import { ClaimsService } from '../src/claims/claims.service';
import { EntityService } from '../src/entity/entity.service';

const root = resolve(__dirname, '../../..');
for (const f of [resolve(root, '.env')]) if (existsSync(f)) process.loadEnvFile(f);

const args = new Set(process.argv.slice(2));
const source = new FixtureSectorsDataSource(DEV_FIXTURE);
const llm = new LlmService();
const claims = new ClaimsService(llm);

async function runClaimCases(): Promise<CaseScore[]> {
  const cases = z.array(ClaimCase).parse(JSON.parse(readFileSync(resolve(root, 'evals/claim-cases.json'), 'utf8')));
  const planner: Planner = args.has('--llm-planner') ? new LlmPlanner(llm) : new DeterministicPlanner();
  console.log(`claim cases: ${cases.length}, planner: ${planner.name}, data: fixture`);

  const scores: CaseScore[] = [];
  for (const c of cases) {
    const scope = claims.toContract(c.claim.claimType, c.claim.verifiability, null);
    const claim: Claim = {
      id: randomUUID(),
      sessionId: 'eval',
      originalText: c.claim.normalizedText,
      normalizedText: c.claim.normalizedText,
      ticker: c.claim.ticker,
      claimType: c.claim.claimType,
      comparisonType: 'ABSOLUTE',
      timeScope: null,
      assessment: null,
      ...scope,
    };
    const r = await investigateClaim(claim, { source, planner, newId: randomUUID });
    const { issues } = validateClaimReport(composeClaimReport({ claim, ...r }), r.evidence);
    const toolPath = r.trace.filter((t) => t.action.startsWith('get_')).map((t) => String(t.action));
    scores.push(
      scoreClaimCase(c, {
        assessment: r.assessment,
        stopReason: r.stopReason,
        replanned: r.trace.some((t) => t.action === 'REPLAN'),
        toolCalls: toolPath.length,
        toolPath,
        uncitedNumbers: issues.filter((i) => i.kind === 'uncited_number').length,
      }),
    );
  }
  return scores;
}

async function runThesisCases(): Promise<CaseScore[]> {
  const cases = z.array(ThesisCase).parse(JSON.parse(readFileSync(resolve(root, 'evals/thesis-cases.json'), 'utf8')));
  const entities = new EntityService(source);
  console.log(`thesis cases: ${cases.length}, extractor: ${llm.available ? `llm:${llm.model}` : 'heuristic-v1'}`);
  const scores: CaseScore[] = [];
  for (const c of cases) {
    const { extraction } = await claims.extract(c.thesis);
    const resolved = await entities.resolveAll(c.thesis, extraction.entities.map((e) => e.mention));
    scores.push(
      scoreThesisCase(c, {
        primaryTicker: resolved.find((r) => r.ticker)?.ticker ?? null,
        claimTypes: extraction.claims.map((x) => x.claim_type),
        abstained: extraction.claims.some((x) => claims.toContract(x.claim_type, x.verifiability, x.scope_note).verifiability === 'NO'),
      }),
    );
  }
  return scores;
}

async function main() {
  const scores = args.has('--theses') ? await runThesisCases() : await runClaimCases();
  console.log(summarize(scores));
  const outDir = resolve(root, 'evals/results');
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `${args.has('--theses') ? 'theses' : 'claims'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ args: [...args], scores }, null, 2));
  console.log(`results: ${file}`);
  if (scores.some((s) => !s.pass)) process.exitCode = 1;
}

void main();
