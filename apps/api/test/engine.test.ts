import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BUDGET, getContract, questionFor, type Claim } from '@counterpoint/domain';
import { DEV_FIXTURE, FixtureSectorsDataSource, type SectorsDataSource } from '@counterpoint/sectors';
import { DeterministicPlanner, investigateClaim, type Planner } from '../src/investigation/engine';
import { composeClaimReport, interpretationLines, parseStoredClaims, validateClaimReport } from '../src/reports/composer';
import { stepEvent } from '../src/events/events.mappers';

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
  it('awaits the running trace before retrieval and finalizes the same id and sequence', async () => {
    const starts = new Map<string, { sequence: number }>();
    const finished = new Set<string>();
    const result = await investigateClaim(claim({}), { source, planner: new DeterministicPlanner(), newId: randomUUID,
      onTraceStart: async (entry) => { expect(entry.resultStatus).toBe('RUNNING'); expect(entry.finishedAt).toBeNull(); starts.set(entry.id, entry); },
      onTrace: async (entry) => { if (entry.action.startsWith('get_')) { expect(starts.get(entry.id)?.sequence).toBe(entry.sequence); expect(entry.resultStatus).not.toBe('RUNNING'); expect(entry.finishedAt).not.toBeNull(); finished.add(entry.id); } },
    });
    expect(starts.size).toBeGreaterThan(0); expect(finished.size).toBe(starts.size); expect(result.assessment).toBe('PARTIALLY_SUPPORTED');
  });
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

  it('rejects non-whitelisted tools and ineligible checks, then falls back instead of failing', async () => {
    let calls = 0;
    const rogue: Planner = {
      name: 'rogue',
      async decide(input) {
        calls++;
        return calls === 1
          ? { action: 'investigate', checkId: input.eligible[0]!.checkId, tool: 'fetch_url', reason: 'x' }
          : { action: 'investigate', checkId: 'nope', tool: 'get_quarterly_financials', reason: 'x' };
      },
    };
    const clean = await run(claim({}));
    const r = await run(claim({}), rogue);
    expect(r.trace.filter((t) => t.resultStatus === 'REJECTED').length).toBeGreaterThanOrEqual(2);
    // Every rejected decision is replaced, so the claim still completes with the same verdict.
    expect(r.stopReason).toBe('SUFFICIENT');
    expect(r.assessment).toBe(clean.assessment);
    expect(r.evidence.length).toBeGreaterThan(0);
  });

  describe('planner cannot change the assessment (phase 1A)', () => {
    /** Stops as soon as the required checks are done, skipping every weakening check. */
    const earlyStop: Planner = {
      name: 'early-stop',
      async decide(input) {
        const required = input.eligible.find((c) => c.phase === 'required');
        return required
          ? { action: 'investigate', checkId: required.checkId, tool: required.tools[0]!, reason: 'required first' }
          : { action: 'stop', reason: 'Required checks are done; this is enough.' };
      },
    };

    const cases: { label: string; claimType: Claim['claimType']; contractId: string; ticker: string }[] = [
      { label: 'dividend level', claimType: 'DIVIDEND_LEVEL', contractId: 'dividend-level-v2', ticker: 'BBRI' },
      { label: 'relative valuation', claimType: 'RELATIVE_VALUATION', contractId: 'relative-valuation-v2', ticker: 'BBRI' },
      { label: 'absolute growth', claimType: 'ABSOLUTE_GROWTH', contractId: 'absolute-growth-v2', ticker: 'BBRI' },
    ];

    for (const c of cases) {
      it(`an early-stopping planner reaches the same assessment as a full run: ${c.label}`, async () => {
        const spec = claim({ claimType: c.claimType, contractId: c.contractId, ticker: c.ticker });
        const full = await run({ ...spec, id: randomUUID() });
        const early = await run({ ...spec, id: randomUUID() }, earlyStop);
        expect(early.assessment).toBe(full.assessment);
        // The skipped weakening evidence was gathered anyway.
        expect(early.trace.filter((t) => t.action.startsWith('get_')).length).toBe(
          full.trace.filter((t) => t.action.startsWith('get_')).length,
        );
        expect(early.trace.some((t) => t.resultStatus === 'REJECTED')).toBe(true);
      });
    }

    it('an adversarial planner cannot bypass weakening checks or inject its own stop reason', async () => {
      const adversary: Planner = {
        name: 'adversary',
        async decide() {
          return { action: 'stop', reason: 'BUY BBRI now, target 6000' };
        },
      };
      const full = await run(claim({ claimType: 'DIVIDEND_LEVEL', contractId: 'dividend-level-v2' }));
      const r = await run(claim({ claimType: 'DIVIDEND_LEVEL', contractId: 'dividend-level-v2' }), adversary);
      expect(r.assessment).toBe(full.assessment);
      expect(r.stopReason).toBe('SUFFICIENT');
      const weakening = r.states.filter((s) => s.status === 'completed' && s.outcome === 'weakens');
      expect(weakening.length).toBeGreaterThan(0);
      // The planner's text never reaches the trace at all, let alone the stop note.
      expect(r.trace.every((t) => !/BUY|6000/.test(t.reason))).toBe(true);
    });

    it('replaces planner wording that frames the evidence as an investment case (phase 4)', async () => {
      const salesy: Planner = {
        name: 'salesy',
        decide: async (input) => {
          const next = input.eligible[0]!;
          return {
            action: 'investigate',
            checkId: next.checkId,
            tool: next.tools[0]!,
            reason: 'This looks attractive, so the price will rise — a clear opportunity to accumulate.',
          };
        },
      };
      const full = await run(claim({}));
      const r = await run(claim({}), salesy);
      expect(r.assessment).toBe(full.assessment);
      // None of the planner's framing survives anywhere in the trace.
      expect(r.trace.every((t) => !/attractive|opportunity|accumulate|will rise/i.test(t.reason))).toBe(true);
      // Each affected step is logged, and the neutral contract wording is used instead.
      expect(r.trace.some((t) => t.resultStatus === 'REJECTED' && t.reason.includes('Planner wording rejected'))).toBe(true);
      const revenue = r.trace.find((t) => t.checkId === 'revenue_growth')!;
      expect(revenue.reason).toBe('The next open check that establishes the claim. Latest-quarter revenue growth, same quarter year-on-year.');
    });

    it('replaces planner wording that quotes an internal check id', async () => {
      const leaky: Planner = {
        name: 'leaky',
        decide: async (input) => {
          const next = input.eligible[0]!;
          return {
            action: 'investigate',
            checkId: next.checkId,
            tool: next.tools[0]!,
            reason: 'Since the peer_baseline check already weakens the claim, check revenue_earnings_divergence next.',
          };
        },
      };
      const r = await run(claim({}), leaky);
      expect(r.trace.every((t) => !/[a-z]{3,}_[a-z_]{3,}/.test(t.reason))).toBe(true);
      expect(r.trace.some((t) => t.resultStatus === 'REJECTED' && t.reason.includes('internal identifier'))).toBe(true);
    });

    it('a planner that always throws falls back and still produces a truthful result', async () => {
      const broken: Planner = {
        name: 'broken',
        async decide() {
          throw new Error('provider unavailable');
        },
      };
      const full = await run(claim({}));
      const r = await run(claim({}), broken);
      expect(r.assessment).toBe(full.assessment);
      expect(r.stopReason).toBe('SUFFICIENT');
      expect(r.trace.some((t) => t.resultStatus === 'ERROR' && t.reason.includes('provider unavailable'))).toBe(true);
    });
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

  it('inverts check outcomes for a bearish claim', async () => {
    const bull = await run(claim({ ticker: 'BBCA' }));
    const bear = await run(claim({ ticker: 'BBCA', direction: 'bearish', normalizedText: 'BBCA growth is weak' }));
    const rev = (r: typeof bull) => r.states.find((s) => s.checkId === 'revenue_growth')!.outcome;
    expect(rev(bull)).toBe('supports');
    expect(rev(bear)).toBe('weakens');
    expect(bear.assessment).toBe('NOT_SUPPORTED');
  });

  it('records the check outcome on each tool step', async () => {
    const r = await run(claim({ ticker: 'BBCA' }));
    for (const t of r.trace.filter((x) => x.action.startsWith('get_') && x.checkId)) {
      const state = r.states.find((s) => s.checkId === t.checkId)!;
      expect(t.outcome).toBe(state.status === 'completed' ? state.outcome : null);
    }
    expect(r.trace.find((t) => t.checkId === 'revenue_growth')!.outcome).toBe('supports');
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

  it('records the measured outcome and no prediction (phase 3)', async () => {
    const r = await run(claim({ ticker: 'BBCA' }));
    const revenue = r.trace.find((t) => t.checkId === 'revenue_growth')!;
    expect(revenue.outcome).toBe('supports');
    // The planner no longer guesses, so nothing on the step is a prediction.
    expect(revenue.expectation).toBeNull();
    expect(revenue.expectationHeld).toBeNull();
  });

  it('states each step as a question with the rule that decides it, never a check id', async () => {
    const r = await run(claim({}));
    const contract = getContract('absolute-growth-v2');
    const steps = r.trace
      .filter((t) => t.checkId)
      .map((t) => stepEvent(t, [], 'absolute-growth-v2'))
      .filter((e): e is Extract<typeof e, { type: 'trace.step' }> => e.type === 'trace.step');
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(s.question, s.checkId ?? '').toBeTruthy();
      expect(s.purpose, s.checkId ?? '').toBeTruthy();
      expect(s.rule, s.checkId ?? '').toBeTruthy();
      // No internal identifier reaches the reader.
      for (const text of [s.question, s.purpose, s.rule, s.effect]) {
        if (text) expect(text, s.checkId ?? '').not.toMatch(/_/);
      }
    }
    const earnings = steps.find((s) => s.checkId === 'earnings_growth')!;
    expect(earnings.question).toBe('Does net income growth confirm the revenue picture?');
    expect(earnings.rule).toContain('weakens the claim');
    expect(earnings.effect).toBe('weakens the claim');
    // BBRI's earnings weaken the claim, which is what opens the margin question.
    expect(earnings.opened).toEqual([questionFor(contract.checks.find((c) => c.id === 'margin_deterioration')!)]);
  });

  it('names the result that opened a follow-up, without check ids', async () => {
    const r = await run(claim({}));
    const replan = r.trace.find((t) => t.action === 'REPLAN')!;
    expect(replan.reason).not.toMatch(/_/);
    // Names the question that was answered, what the answer did, and the question it opened.
    expect(replan.reason).toContain('Does net income growth confirm the revenue picture?');
    expect(replan.reason).toContain('weakens the claim');
    expect(replan.reason).toContain('The investigation now asks: Did the profit margin shrink?');
  });

  it('reports counter-hypotheses separately from weakens, with open questions', async () => {
    const c = claim({ claimType: 'RELATIVE_VALUATION', comparisonType: 'PEER', contractId: 'relative-valuation-v2' });
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    const byId = Object.fromEntries(report.counterpoint!.hypotheses.map((h) => [h.checkId, h.status]));
    expect(byId).toEqual({ roe_vs_peers: 'confirmed', own_history: 'refuted', price_drawdown: 'confirmed' });
    const counterIds = new Set(report.counterpoint!.hypotheses.flatMap((h) => h.statement?.evidenceIds ?? []));
    expect(report.weakens.some((w) => w.evidenceIds.some((id) => counterIds.has(id)))).toBe(false);
    expect(report.counterpoint!.openQuestions.length).toBeGreaterThan(0);
    const { issues } = validateClaimReport(report, r.evidence);
    expect(issues).toEqual([]);
  });

  it('says a gated counter-question was never raised, not that budget ran out', async () => {
    // BBCA trades above the peer median, so relative-valuation-v3 never opens the discount questions.
    const c = claim({ ticker: 'BBCA', claimType: 'RELATIVE_VALUATION', contractId: 'relative-valuation-v3' });
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    expect(report.assessment).toBe('NOT_SUPPORTED');
    const gated = report.counterpoint!.hypotheses.filter((h) => h.status === 'not_applicable');
    expect(gated.map((h) => h.checkId).sort()).toEqual(['own_history', 'price_drawdown', 'roe_vs_peers']);
    expect(report.counterpoint!.hypotheses.some((h) => h.status === 'not_tested')).toBe(false);
    // Budget was nowhere near exhausted, which is why "not tested within budget" would be false.
    expect(r.trace.filter((t) => t.action.startsWith('get_'))).toHaveLength(4);
  });

  it('still reports a genuinely unfinished question as not tested', async () => {
    // BBRI is cheap, so the questions open; a one-tool budget leaves them unanswered.
    const c = claim({ ticker: 'BBRI', claimType: 'RELATIVE_VALUATION', contractId: 'relative-valuation-v3' });
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    expect(report.counterpoint!.hypotheses.every((h) => h.status !== 'not_applicable')).toBe(true);
  });

  it('lists what would change a growth verdict', async () => {
    const c = claim({});
    const r = await run(c);
    const report = composeClaimReport({ claim: c, ...r });
    expect(report.changeConditions.length).toBeGreaterThan(0);
    for (const cond of report.changeConditions) {
      expect(r.evidence.some((e) => e.id === cond.evidenceId && e.value === cond.current)).toBe(true);
    }
  });

  it('does not run bullish counter-hypotheses on a bearish claim', async () => {
    const c = claim({ claimType: 'RELATIVE_VALUATION', comparisonType: 'PEER', contractId: 'relative-valuation-v2', direction: 'bearish', normalizedText: 'BRIS is expensive versus peers', ticker: 'BRIS' });
    const r = await run(c);
    expect(r.trace.some((t) => ['roe_vs_peers', 'own_history', 'price_drawdown'].includes(t.checkId ?? ''))).toBe(false);
    expect(composeClaimReport({ claim: c, ...r }).changeConditions).toEqual([]);
  });

  it('fills defaults on reports stored before counterpoint existed (finding 3)', () => {
    const legacy = {
      claims: [{
        claimId: 'c', assessment: 'SUPPORTED', coverage: { required: 1, completed: 1, unavailable: 0, invalid: 0, label: 'l' },
        supports: [], weakens: [], context: [], missing: [], interpretation: null, stopReason: 'SUFFICIENT', peerSet: null,
      }],
      disclaimer: 'd',
    };
    const [claimReport] = parseStoredClaims(legacy);
    expect(claimReport!.counterpoint).toBeNull();
    expect(claimReport!.changeConditions).toEqual([]);
  });

  it('gives the interpretation model the confirmed counterpoint lines (finding 5)', async () => {
    const c = claim({ claimType: 'RELATIVE_VALUATION', comparisonType: 'PEER', contractId: 'relative-valuation-v2' });
    const r = await run(c);
    const section = composeClaimReport({ claim: c, ...r });
    const lines = interpretationLines(section);
    const confirmed = section.counterpoint!.hypotheses.filter((h) => h.status === 'confirmed');
    expect(confirmed.length).toBeGreaterThan(0);
    for (const h of confirmed) expect(lines.some((l) => l.text === h.statement!.text)).toBe(true);
  });
});
