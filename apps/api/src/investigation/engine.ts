import {
  BUDGET,
  type CheckDefinition,
  type CheckState,
  type Claim,
  type EvidenceContract,
  type EvidenceItem,
  type ExecutionTrace,
  type FrozenPeerSet,
  type StopReason,
  ToolName,
  assess,
  contradictions,
  describeTrigger,
  effectText,
  evaluateChecks,
  guardLanguage,
  questionFor,
  ruleTextFor,
  evidenceCoverage,
  getContract,
  openChecks,
  phaseOf,
  type Assessment,
  type CheckPhase,
  type Coverage,
} from '@counterpoint/domain';
import type { SectorsDataSource } from '@counterpoint/sectors';
import { METRIC_BUILDERS, type BuildContext } from './evidence-builders';

export interface EligibleCheck {
  checkId: string;
  kind: CheckDefinition['kind'];
  phase: 'required' | 'counter' | 'counterpoint';
  description: string;
  hypothesis: string | null;
  /** The question this check answers, and the rule that will decide it. Stated before retrieval. */
  question: string;
  rule: string | null;
  tools: ToolName[];
  triggeredBy: string[] | null;
}

export interface PlannerInput {
  claim: Pick<Claim, 'normalizedText' | 'claimType' | 'ticker'>;
  contractId: string;
  eligible: EligibleCheck[];
  states: CheckState[];
  contradictions: string[];
  budget: { toolCallsUsed: number; toolCallsLeft: number; replansLeft: number };
  history: { checkId: string; tool: string; result: string }[];
}

export type PlannerDecision =
  | { action: 'investigate'; checkId: string; tool: string; reason: string }
  | { action: 'stop'; reason: string };

type InvestigateDecision = Extract<PlannerDecision, { action: 'investigate' }>;

export interface Planner {
  readonly name: string;
  decide(input: PlannerInput): Promise<PlannerDecision>;
}

/** A snake_case token, i.e. an internal check or metric id the planner should not be quoting. */
const INTERNAL_ID = /\b[a-z]{3,}_[a-z_]{3,}\b/;

/** Neutral, contract-derived wording for why a check is being run. Never model-written. */
export function defaultReason(next: EligibleCheck): string {
  // The description keeps its own capitalisation, so acronyms like P/E survive.
  if (next.triggeredBy?.length) return `Opened by the previous result. ${next.description}.`;
  if (next.phase === 'counterpoint') return `Testing the counter-case: ${next.hypothesis}`;
  const kind = next.kind === 'required' ? 'check that establishes the claim' : 'check for evidence against it';
  return `The next open ${kind}. ${next.description}.`;
}

/** Deterministic planner: first eligible check, first allowed tool. Used when no LLM is configured and as a fallback. */
export class DeterministicPlanner implements Planner {
  readonly name = 'deterministic-v1';
  async decide(input: PlannerInput): Promise<PlannerDecision> {
    const next = input.eligible[0];
    if (!next) return { action: 'stop', reason: 'No eligible checks remain.' };
    return { action: 'investigate', checkId: next.checkId, tool: next.tools[0]!, reason: defaultReason(next) };
  }
}

export interface InvestigationResult {
  evidence: EvidenceItem[];
  trace: ExecutionTrace[];
  states: CheckState[];
  coverage: Coverage | null;
  assessment: Assessment;
  stopReason: StopReason;
  peerSet: FrozenPeerSet | null;
}

export interface InvestigationDeps {
  source: SectorsDataSource;
  planner: Planner;
  newId: () => string;
  now?: () => Date;
  onTrace?: (t: ExecutionTrace, evidence: EvidenceItem[]) => void | Promise<void>;
  /** Epoch ms after which the claim stops with TIMEOUT (NFR-005). */
  deadline?: number;
}

export async function investigateClaim(claim: Claim, deps: InvestigationDeps): Promise<InvestigationResult> {
  const now = deps.now ?? (() => new Date());
  const trace: ExecutionTrace[] = [];
  const record = async (t: Omit<ExecutionTrace, 'id' | 'claimId' | 'sequence'>, items: EvidenceItem[] = []) => {
    const entry: ExecutionTrace = { id: deps.newId(), claimId: claim.id, sequence: trace.length, ...t };
    trace.push(entry);
    await deps.onTrace?.(entry, items);
  };
  const instant = (action: ExecutionTrace['action'], reason: string, extra: Partial<ExecutionTrace> = {}) => {
    const ts = now().toISOString();
    return record({ action, reason, startedAt: ts, finishedAt: ts, evidenceIds: [], resultStatus: 'OK', stopReason: null, checkId: null, expectation: null, expectationHeld: null, outcome: null, ...extra });
  };

  const contract: EvidenceContract | null = claim.contractId ? getContract(claim.contractId) : null;
  if (!contract || claim.verifiability === 'NO' || !claim.ticker) {
    const reason = claim.scopeNote ?? (claim.ticker ? 'Claim is outside supported evidence contracts.' : 'No resolved company for this claim.');
    await instant('STOP', reason, { stopReason: 'OUT_OF_SCOPE' });
    return { evidence: [], trace, states: [], coverage: null, assessment: 'UNVERIFIABLE', stopReason: 'OUT_OF_SCOPE', peerSet: null };
  }

  const memoStore = new Map<string, Promise<unknown>>();
  const ctx: BuildContext = {
    claimId: claim.id,
    ticker: claim.ticker,
    source: deps.source,
    minPeers: contract.thresholds.minPeers ?? 4,
    newId: deps.newId,
    peerSet: null,
    memo: <T>(key: string, fn: () => Promise<T>) => {
      if (!memoStore.has(key)) memoStore.set(key, fn().catch((e) => { memoStore.delete(key); throw e; }));
      return memoStore.get(key) as Promise<T>;
    },
  };

  const evidence: EvidenceItem[] = [];
  const executed = new Set<string>();
  const acceptedTriggers = new Set<string>();
  const blockedTriggers = new Set<string>();
  const history: PlannerInput['history'] = [];
  let toolCalls = 0;
  let replans = 0;
  let counterpointsRun = 0;
  let stopReason: StopReason | null = null;
  let stopNote = '';
  /** Replaces any decision the planner is not allowed to make, so a bad planner cannot end a claim. */
  const fallbackPlanner = new DeterministicPlanner();

  // Counted, not listed by id: this reason is stored and served, so it has to read as prose.
  const countOf = (p: CheckPhase) => contract.checks.filter((c) => phaseOf(c) === p).length;
  await instant(
    'PLAN',
    `Lined up the checks for this claim under contract ${contract.id}: ${countOf('required')} to establish it, ` +
      `${countOf('counter')} looking for evidence against it, and ${countOf('counterpoint')} testing the strongest opposing case. ` +
      `Some open only if a result calls for them.`,
  );

  let states = evaluateChecks(contract, evidence, claim.direction);
  while (!stopReason) {
    if (deps.deadline !== undefined && now().getTime() >= deps.deadline) {
      stopReason = 'TIMEOUT';
      stopNote = 'Session time limit reached; reporting what was found so far.';
      break;
    }
    let eligible = openChecks(contract, states, counterpointsRun, claim.direction).filter((c) => !blockedTriggers.has(c.id));
    const newlyTriggered = eligible.filter((c) => c.triggeredBy && !acceptedTriggers.has(c.id));
    if (newlyTriggered.length) {
      const opened = newlyTriggered.map((c) => questionFor(c));
      if (replans < BUDGET.maxReplans) {
        replans++;
        newlyTriggered.forEach((c) => acceptedTriggers.add(c.id));
        await instant(
          'REPLAN',
          `${replanCause(contract, newlyTriggered, states)} The investigation now asks: ${opened.join(' ')}`,
        );
      } else {
        newlyTriggered.forEach((c) => blockedTriggers.add(c.id));
        eligible = eligible.filter((c) => !blockedTriggers.has(c.id));
        await instant(
          'EVALUATE',
          `No budget left to follow up, so ${opened.length} further question${opened.length === 1 ? '' : 's'} stay unanswered: ${opened.join(' ')}`,
        );
      }
    }

    const required = states.filter((s) => s.kind === 'required');
    const reachable = required.filter((s) => s.status === 'completed' || s.status === 'pending').length;

    if (reachable < contract.minRequiredCompleted) {
      stopReason = 'UNOBTAINABLE';
      stopNote = `Only ${reachable} required checks can still complete; contract needs ${contract.minRequiredCompleted}.`;
      break;
    }
    if (eligible.length === 0) {
      stopReason = assess(contract, states, claim.verifiability) === 'UNVERIFIABLE' ? 'UNOBTAINABLE' : 'SUFFICIENT';
      stopNote = 'All eligible checks are resolved.';
      break;
    }
    if (toolCalls >= BUDGET.maxToolCalls) {
      stopReason = 'BUDGET_EXHAUSTED';
      stopNote = `Tool budget of ${BUDGET.maxToolCalls} reached with ${eligible.length} checks open.`;
      break;
    }

    const input: PlannerInput = {
      claim,
      contractId: contract.id,
      eligible: eligible.map((c) => ({
        checkId: c.id, kind: c.kind, phase: phaseOf(c), description: c.description, hypothesis: c.hypothesis ?? null,
        question: questionFor(c), rule: ruleTextFor(c, contract.thresholds),
        tools: c.tools, triggeredBy: c.triggeredBy?.map(describeTrigger) ?? null,
      })),
      states,
      contradictions: contradictions(states),
      budget: { toolCallsUsed: toolCalls, toolCallsLeft: BUDGET.maxToolCalls - toolCalls, replansLeft: BUDGET.maxReplans - replans },
      history,
    };

    let decision: PlannerDecision;
    try {
      decision = await deps.planner.decide(input);
    } catch (err) {
      await instant('EVALUATE', `Planner ${deps.planner.name} failed (${(err as Error).message}); using deterministic planner for this step.`, { resultStatus: 'ERROR' });
      decision = await fallbackPlanner.decide(input);
    }

    /**
     * The planner never ends an investigation: control only reaches here while eligible checks
     * remain, so stopping would skip contract evidence and could only move the verdict in the
     * claim's favour. Every invalid decision is replaced by the deterministic planner's choice
     * for this step, so a bad or adversarial planner changes the order of the investigation,
     * never its conclusion.
     */
    let checked = validateDecision(decision, eligible, executed);
    if (!checked.ok) {
      await instant('EVALUATE', `Rejected planner decision: ${checked.reason}. Using the deterministic planner for this step.`, { resultStatus: 'REJECTED' });
      checked = validateDecision(await fallbackPlanner.decide(input), eligible, executed);
      if (!checked.ok) {
        stopReason = 'ERROR';
        stopNote = `No valid next step could be produced: ${checked.reason}.`;
        break;
      }
    }
    let step = checked.step;

    /**
     * The planner's sentence is the only model-written text in the trace, so it passes the same
     * advice and causality guard as the report. Anything that frames the evidence as an
     * investment case is replaced by the contract's own neutral wording.
     */
    const eligibleStep = input.eligible.find((c) => c.checkId === step.checkId)!;
    // The planner is shown check ids so it can name its choice; it must not echo them at the reader.
    const leakedId = INTERNAL_ID.test(step.reason) ? ['internal identifier'] : [];
    const kinds = [...new Set([...guardLanguage(step.reason).map((i) => i.kind), ...leakedId])];
    if (kinds.length) {
      // Only the kind of problem is logged: quoting the rejected words would put them on screen.
      await instant('EVALUATE', `Planner wording rejected (${kinds.join(', ')}); using neutral wording.`, {
        resultStatus: 'REJECTED',
      });
      step = { ...step, reason: defaultReason(eligibleStep) };
    }

    const check = contract.checks.find((c) => c.id === step.checkId)!;
    const tool = step.tool as ToolName;
    executed.add(`${check.id}:${tool}`);
    toolCalls++;
    if (phaseOf(check) === 'counterpoint') counterpointsRun++;
    const startedAt = now().toISOString();
    const { items, failure } = await runCheck(ctx, check, evidence);
    evidence.push(...items);
    const before = new Map(states.map((s) => [s.checkId, s.status]));
    states = evaluateChecks(contract, evidence, claim.direction);
    const allUnavailable = items.length > 0 && items.every((i) => i.status !== 'VALID');
    const resultStatus = failure ? 'ERROR' : allUnavailable ? 'NO_DATA' : 'OK';
    history.push({ checkId: check.id, tool, result: resultStatus });
    const state = states.find((s) => s.checkId === check.id);
    await record(
      {
        action: tool,
        reason: step.reason,
        startedAt,
        finishedAt: now().toISOString(),
        evidenceIds: items.map((i) => i.id),
        resultStatus,
        stopReason: null,
        checkId: check.id,
        expectation: null,
        expectationHeld: null,
        outcome: state?.status === 'completed' ? state.outcome : null,
      },
      items,
    );

    const resolved = states.filter((s) => before.get(s.checkId) === 'pending' && s.status !== 'pending');
    if (resolved.length) {
      await instant(
        'EVALUATE',
        resolved
          .map((s) => {
            const def = contract.checks.find((c) => c.id === s.checkId);
            const what = def ? questionFor(def) : s.checkId;
            const how = s.outcome ? effectText(s.outcome) : s.status;
            return `${what} — ${how}${s.note ? ` (${s.note})` : ''}`;
          })
          .join('; '),
        { evidenceIds: resolved.flatMap((s) => s.evidenceIds) },
      );
    }
  }

  const assessment = assess(contract, states, claim.verifiability);
  await instant('STOP', stopNote, { stopReason });
  return { evidence, trace, states, coverage: evidenceCoverage(states), assessment, stopReason, peerSet: ctx.peerSet };
}

/**
 * Tool router: whitelisted tools only, tool must serve the chosen check, no duplicate signatures,
 * and no stopping while checks are open. Returns the executable step, or the reason the decision
 * is unusable. Called only when `eligible` is non-empty, so `stop` is never valid here.
 */
function validateDecision(
  d: PlannerDecision,
  eligible: CheckDefinition[],
  executed: Set<string>,
): { ok: true; step: InvestigateDecision } | { ok: false; reason: string } {
  if (d.action === 'stop') {
    return {
      ok: false,
      reason: `asked to stop while ${eligible.length} check(s) are still open (${eligible.map((c) => c.id).join(', ')})`,
    };
  }
  if (!ToolName.safeParse(d.tool).success) return { ok: false, reason: `tool "${d.tool}" is not whitelisted` };
  const check = eligible.find((c) => c.id === d.checkId);
  if (!check) return { ok: false, reason: `check "${d.checkId}" is not eligible` };
  if (!check.tools.includes(d.tool as ToolName)) {
    return { ok: false, reason: `tool "${d.tool}" cannot produce check "${d.checkId}"` };
  }
  if (executed.has(`${d.checkId}:${d.tool}`)) {
    return { ok: false, reason: `"${d.checkId}" already ran with "${d.tool}"` };
  }
  return { ok: true, step: d };
}

/**
 * Names, in words, the result that opened a follow-up. Check ids never reach the reader: the
 * triggering check is named by the question it answered and what that answer did to the claim.
 */
function replanCause(
  contract: EvidenceContract,
  opened: CheckDefinition[],
  states: CheckState[],
): string {
  const resolved = new Map(
    states.filter((s) => s.status === 'completed').map((s) => [s.checkId, s.outcome]),
  );
  const causes = new Set<string>();
  for (const check of opened) {
    for (const t of check.triggeredBy ?? []) {
      const id = typeof t === 'string' ? t : t.check;
      const wanted = typeof t === 'string' ? ('weakens' as const) : t.outcome;
      if (resolved.get(id) !== wanted) continue;
      const source = contract.checks.find((c) => c.id === id);
      if (source) causes.add(`\u201c${questionFor(source)}\u201d \u2014 ${effectText(wanted)}.`);
    }
  }
  return [...causes].join(' ');
}

async function runCheck(
  ctx: BuildContext,
  check: CheckDefinition,
  existing: EvidenceItem[],
): Promise<{ items: EvidenceItem[]; failure: string | null }> {
  const have = new Set([...existing].map((e) => e.metric));
  const items: EvidenceItem[] = [];
  let failure: string | null = null;
  for (const metric of check.metrics) {
    if (have.has(metric)) continue;
    const build = METRIC_BUILDERS[metric];
    if (!build) {
      items.push({
        id: ctx.newId(), claimId: ctx.claimId, checkId: check.id, metric, ticker: ctx.ticker, value: null, unit: 'percent',
        economicPeriod: null, comparisonPeriod: null, observationDate: null, retrievalTime: new Date().toISOString(),
        sourceLocator: 'not-implemented', derivedFrom: [], calculationVersion: null, status: 'UNAVAILABLE',
        note: `no data source for ${metric} in this version`,
      });
      have.add(metric);
      continue;
    }
    let built: EvidenceItem[] | null = null;
    let lastError = '';
    for (let attempt = 0; attempt <= BUDGET.transientRetries && !built; attempt++) {
      try {
        built = await build(ctx, check.id);
      } catch (err) {
        lastError = (err as Error).message;
      }
    }
    if (!built) {
      failure = lastError;
      built = [
        {
          id: ctx.newId(), claimId: ctx.claimId, checkId: check.id, metric, ticker: ctx.ticker, value: null, unit: 'percent',
          economicPeriod: null, comparisonPeriod: null, observationDate: null, retrievalTime: new Date().toISOString(),
          sourceLocator: 'tool-failure', derivedFrom: [], calculationVersion: null, status: 'UNAVAILABLE',
          note: `data retrieval failed: ${lastError}`,
        },
      ];
    }
    items.push(...built);
    built.forEach((b) => have.add(b.metric));
  }
  return { items, failure };
}
