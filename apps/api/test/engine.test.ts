import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BUDGET, type Claim } from '@counterpoint/domain';
import { DEV_FIXTURE, FixtureSectorsDataSource, type SectorsDataSource } from '@counterpoint/sectors';
import { DeterministicPlanner, investigateClaim, type Planner } from '../src/investigation/engine';
import { composeClaimReport, validateClaimReport } from '../src/reports/composer';

const source = new FixtureSectorsDataSource(DEV_FIXTURE);

function claim(overrides: Partial<Claim>): Claim {
  return {
    id: randomUUID(),
    sessionId: 's1',
    originalText: 'growth kuat',
    normalizedText: 'Company has strong recent fundamental growth',
    ticker: 'BBRI',
    claimType: 'ABSOLUTE_GROWTH',
    comparisonType: 'HISTORICAL',
    timeScope: null,
    verifiability: 'YES',
    contractId: 'absolute-growth-v2',
    assessment: null,
    scopeNote: null,
    direction: 'bullish',
    span: null,
    ...overrides,
  };
}

const run = (c: Claim, planner: Planner = new DeterministicPlanner(), src: SectorsDataSource = source) =>
  investigateClaim(c, { source: src, planner, newId: randomUUID });

const toolPath = (r: Awaited<ReturnType<typeof run>>) =>
  r.trace.filter((t) => !['EVALUATE'].includes(t.action)).map((t) => t.action);

describe('investigation engine', () => {
  it('follows a contradiction-driven branch for diverging revenue/earnings (BBRI)', async () => {
    const r = await run(claim({}));
    expect(toolPath(r)).toContain('REPLAN');
    const margin = r.states.find((s) => s.checkId === 'margin_deterioration');
    expect(margin?.status).toBe('completed');
    expect(margin?.outcome).toBe('weakens');
    expect(r.assessment).toBe('PARTIALLY_SUPPORTED');
    expect(r.stopReason).toBe('SUFFICIENT');
  });

  it('takes a different, shorter path when evidence is consistent (BBCA)', async () => {
    const bbri = await run(claim({}));
    const bbca = await run(claim({ ticker: 'BBCA' }));
    expect(toolPath(bbca)).not.toContain('REPLAN');
    expect(toolPath(bbca)).not.toEqual(toolPath(bbri));
    expect(bbca.states.find((s) => s.checkId === 'margin_deterioration')?.status).toBe('pending');
    expect(bbca.assessment).toBe('SUPPORTED');
  });

  it('abstains on forward-looking claims without calling tools', async () => {
    const r = await run(
      claim({ claimType: 'FORWARD_LOOKING', contractId: null, verifiability: 'NO', scopeNote: 'Future price claims are outside available evidence.' }),
    );
    expect(r.assessment).toBe('UNVERIFIABLE');
    expect(r.stopReason).toBe('OUT_OF_SCOPE');
    expect(r.evidence).toHaveLength(0);
  });

  it('uses a frozen deterministic peer set for relative valuation', async () => {
    const r = await run(claim({ claimType: 'RELATIVE_VALUATION', comparisonType: 'PEER', contractId: 'relative-valuation-v2' }));
    expect(r.peerSet?.included.map((p) => p.ticker)).toEqual(['BBCA', 'BBNI', 'BMRI', 'BRIS']);
    expect(r.peerSet?.excluded.map((p) => p.ticker)).toContain('BBRI');
    // v2: cheap on P/E, but the counterpoint confirms ROE 3.6 pp below the peer median
    // (roe_vs_peers) and a 29% fall from the past-year high (price_drawdown).
    expect(r.assessment).toBe('PARTIALLY_SUPPORTED');
    const confirmed = r.states.filter((s) => s.outcome === 'weakens').map((s) => s.checkId);
    expect(confirmed).toEqual(expect.arrayContaining(['roe_vs_peers', 'price_drawdown']));
  });

  it('assesses the dividend contract end to end', async () => {
    const r = await run(claim({ claimType: 'DIVIDEND_LEVEL', contractId: 'dividend-level-v2' }));
    // v2: the yield rose 29.7% while dividend per share rose 10.8%, so the
    // yield_from_price counter-hypothesis is confirmed.
    expect(r.assessment).toBe('PARTIALLY_SUPPORTED');
    expect(r.states.find((s) => s.checkId === 'yield_from_price')?.outcome).toBe('weakens');
    expect(r.coverage?.label).toBe('3 of 3 required checks available');
  });

  it('reports missing data truthfully when the company has no financials', async () => {
    const r = await run(claim({ ticker: 'TLKM' }));
    expect(r.assessment).toBe('UNVERIFIABLE');
    expect(r.stopReason).toBe('UNOBTAINABLE');
  });

  it('rejects non-whitelisted tools and duplicate decisions', async () => {
    let calls = 0;
    const rogue: Planner = {
      name: 'rogue',
      async decide(input) {
        calls++;
        return calls === 1
          ? { action: 'investigate', checkId: input.eligible[0]!.checkId, tool: 'fetch_url', reason: 'x', expectation: null }
          : { action: 'investigate', checkId: 'nope', tool: 'get_quarterly_financials', reason: 'x', expectation: null };
      },
    };
    const r = await run(claim({}), rogue);
    expect(r.trace.filter((t) => t.resultStatus === 'REJECTED')).toHaveLength(2);
    expect(r.stopReason).toBe('ERROR');
    expect(r.evidence).toHaveLength(0);
  });

  it('retries a transient failure once, then records unavailable evidence', async () => {
    let attempts = 0;
    const flaky: SectorsDataSource = {
      ...source,
      searchCompanies: source.searchCompanies.bind(source),
      getCompanyProfile: source.getCompanyProfile.bind(source),
      getAnnualFinancials: source.getAnnualFinancials.bind(source),
      getDividendHistory: source.getDividendHistory.bind(source),
      getValuation: source.getValuation.bind(source),
      getPeerCandidates: source.getPeerCandidates.bind(source),
      async getQuarterlyFinancials() {
        attempts++;
        throw new Error('503');
      },
    };
    const r = await run(claim({}), new DeterministicPlanner(), flaky);
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(r.trace.some((t) => t.resultStatus === 'ERROR')).toBe(true);
    expect(r.assessment).toBe('UNVERIFIABLE');
  });

  it('never exceeds the tool budget', async () => {
    const r = await run(claim({}));
    const toolCalls = r.trace.filter((t) => t.action.startsWith('get_')).length;
    expect(toolCalls).toBeLessThanOrEqual(BUDGET.maxToolCalls);
  });

  it('stops with TIMEOUT when the session deadline has passed', async () => {
    let t = Date.parse('2026-10-02T00:00:00Z');
    const r = await investigateClaim(claim({ ticker: 'BBCA' }), {
      source,
      planner: new DeterministicPlanner(),
      newId: randomUUID,
      now: () => new Date((t += 30_000)),
      deadline: Date.parse('2026-10-02T00:01:00Z'),
    });
    expect(r.stopReason).toBe('TIMEOUT');
    expect(r.trace.at(-1)?.action).toBe('STOP');
    expect(r.trace.filter((x) => x.action.startsWith('get_')).length).toBeLessThan(3);
  });

  it('returns UNVERIFIABLE with TIMEOUT when the deadline passed before the claim started', async () => {
    const r = await investigateClaim(claim({ ticker: 'BBCA' }), {
      source, planner: new DeterministicPlanner(), newId: randomUUID, deadline: Date.now() - 1,
    });
    expect(r.stopReason).toBe('TIMEOUT');
    expect(r.assessment).toBe('UNVERIFIABLE');
    expect(r.evidence).toHaveLength(0);
  });
});

describe('report composer', () => {
  it('produces a report whose every number reconciles with evidence', async () => {
    const c = claim({});
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    expect(report.weakens.length).toBeGreaterThan(0);
    expect(report.supports.length).toBeGreaterThan(0);
    const { issues } = validateClaimReport(report, r.evidence);
    expect(issues).toEqual([]);
  });

  it('validates relative-valuation statements that carry observation dates', async () => {
    const c = claim({ claimType: 'RELATIVE_VALUATION', comparisonType: 'PEER', contractId: 'relative-valuation-v2' });
    const r = await run(c);
    const { issues, report } = validateClaimReport(composeClaimReport({ claim: c, ...r }), r.evidence);
    expect(issues).toEqual([]);
    expect(report.context.length + report.supports.length).toBeGreaterThanOrEqual(3);
  });

  it('strips an interpretation containing uncited numbers or advice', async () => {
    const c = claim({});
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    report.interpretation = { text: 'Growth is 40% so this is a buy.', evidenceIds: [] };
    const { report: cleaned, issues } = validateClaimReport(report, r.evidence);
    expect(cleaned.interpretation).toBeNull();
    expect(issues.map((i) => i.kind)).toEqual(expect.arrayContaining(['uncited_number', 'advice']));
  });

  it('runs counter-hypotheses after required checks and records them in the trace', async () => {
    const r = await run(claim({ ticker: 'BBCA' }));
    const cpIds = ['base_effect', 'earnings_outpacing_revenue', 'roe_trend'];
    const counterpointSteps = r.trace.filter((t) => t.checkId && cpIds.includes(t.checkId));
    expect(counterpointSteps.length).toBeGreaterThan(0);
    const firstCounterpoint = r.trace.indexOf(counterpointSteps[0]!);
    const lastRequired = Math.max(...['revenue_growth', 'earnings_growth', 'historical_context'].map((id) => r.trace.findIndex((t) => t.checkId === id)));
    expect(firstCounterpoint).toBeGreaterThan(lastRequired);
    expect(r.trace.filter((t) => t.action.startsWith('get_')).length).toBeLessThanOrEqual(8);
  });

  it('records whether the planner expectation held', async () => {
    const planner: Planner = {
      name: 'expects-support',
      decide: async (input) => {
        const next = input.eligible[0];
        if (!next) return { action: 'stop', reason: 'done' };
        return { action: 'investigate', checkId: next.checkId, tool: next.tools[0]!, reason: 'r', expectation: 'supports' };
      },
    };
    const r = await run(claim({ ticker: 'BBCA' }), planner);
    const revenue = r.trace.find((t) => t.checkId === 'revenue_growth')!;
    expect(revenue.expectation).toBe('supports');
    expect(typeof revenue.expectationHeld).toBe('boolean');
  });
});
