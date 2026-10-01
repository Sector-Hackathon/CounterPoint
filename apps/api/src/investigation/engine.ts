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
  evaluateChecks,
  evidenceCoverage,
  getContract,
  openChecks,
  phaseOf,
  type Assessment,
  type Expectation,
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
  | { action: 'investigate'; checkId: string; tool: string; reason: string; expectation: Expectation | null }
  | { action: 'stop'; reason: string };

export interface Planner {
  readonly name: string;
  decide(input: PlannerInput): Promise<PlannerDecision>;
}

/** Deterministic planner: first eligible check, first allowed tool. Used when no LLM is configured and as a fallback. */
export class DeterministicPlanner implements Planner {
  readonly name = 'deterministic-v1';
  async decide(input: PlannerInput): Promise<PlannerDecision> {
    const next = input.eligible[0];
    if (!next) return { action: 'stop', reason: 'No eligible checks remain.' };
    const trigger = next.triggeredBy?.filter((t) => input.contradictions.includes(t)) ?? [];
    const reason = next.phase === 'counterpoint'
      ? `Testing the counter-case: ${next.hypothesis}`
      : trigger.length
        ? `Follow-up: ${trigger.join(', ')} weakened the claim, so checking ${next.description.toLowerCase()}.`
        : `Next open ${next.kind} check: ${next.description.toLowerCase()}.`;
    return { action: 'investigate', checkId: next.checkId, tool: next.tools[0]!, reason, expectation: null };
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
  let rejections = 0;
  let stopReason: StopReason | null = null;
  let stopNote = '';

  await instant(
    'PLAN',
    `Contract ${contract.id}: required checks ${contract.checks.filter((c) => c.kind === 'required').map((c) => c.id).join(', ')}; ` +
      `counterchecks ${contract.checks.filter((c) => phaseOf(c) === 'counter' && !c.triggeredBy).map((c) => c.id).join(', ') || 'none'}; ` +
      `counter-hypotheses ${contract.checks.filter((c) => phaseOf(c) === 'counterpoint').map((c) => c.id).join(', ') || 'none'}.`,
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
      const cause = contradictions(states).join(', ');
      if (replans < BUDGET.maxReplans) {
        replans++;
        newlyTriggered.forEach((c) => acceptedTriggers.add(c.id));
        await instant('REPLAN', `Contradiction from ${cause}; adding follow-up ${newlyTriggered.map((c) => c.id).join(', ')}.`);
      } else {
        newlyTriggered.forEach((c) => blockedTriggers.add(c.id));
        eligible = eligible.filter((c) => !blockedTriggers.has(c.id));
        await instant('EVALUATE', `Replan budget exhausted; not following ${newlyTriggered.map((c) => c.id).join(', ')}.`);
      }
    }

    const required = states.filter((s) => s.kind === 'required');
    const reachable = required.filter((s) => s.status === 'completed' || s.status === 'pending').length;
    const pendingRequired = required.filter((s) => s.status === 'pending').length;

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
        tools: c.tools, triggeredBy: c.triggeredBy ?? null,
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
      decision = await new DeterministicPlanner().decide(input);
    }

    if (decision.action === 'stop') {
      if (pendingRequired > 0) {
        await instant('EVALUATE', `Rejected planner stop: ${pendingRequired} required checks still pending. (${decision.reason})`, { resultStatus: 'REJECTED' });
        if (++rejections >= 2) { stopReason = 'ERROR'; stopNote = 'Planner repeatedly issued invalid decisions.'; }
        continue;
      }
      stopReason = 'SUFFICIENT';
      stopNote = decision.reason;
      break;
    }

    const rejection = routeDecision(decision, eligible, executed);
    if (rejection) {
      await instant('EVALUATE', `Router rejected ${decision.checkId}/${decision.tool}: ${rejection.message}`, { resultStatus: 'REJECTED' });
      if (++rejections >= 2) {
        stopReason = rejection.duplicate ? 'DUPLICATE' : 'ERROR';
        stopNote = 'Planner repeatedly issued invalid decisions.';
      }
      continue;
    }

    const check = contract.checks.find((c) => c.id === decision.checkId)!;
    const tool = decision.tool as ToolName;
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
    const expectationHeld =
      decision.expectation && state?.status === 'completed' ? state.outcome === decision.expectation : null;
    await record(
      {
        action: tool,
        reason: decision.reason,
        startedAt,
        finishedAt: now().toISOString(),
        evidenceIds: items.map((i) => i.id),
        resultStatus,
        stopReason: null,
        checkId: check.id,
        expectation: decision.expectation,
        expectationHeld,
        outcome: state?.status === 'completed' ? state.outcome : null,
      },
      items,
    );

    const resolved = states.filter((s) => before.get(s.checkId) === 'pending' && s.status !== 'pending');
    if (resolved.length) {
      await instant(
        'EVALUATE',
        resolved.map((s) => `${s.checkId}: ${s.status}${s.outcome ? ` (${s.outcome})` : ''}${s.note ? ` — ${s.note}` : ''}`).join('; '),
        { evidenceIds: resolved.flatMap((s) => s.evidenceIds) },
      );
    }
  }

  const assessment = assess(contract, states, claim.verifiability);
  await instant('STOP', stopNote, { stopReason });
  return { evidence, trace, states, coverage: evidenceCoverage(states), assessment, stopReason, peerSet: ctx.peerSet };
}

/** Tool router: whitelisted tools only, tool must serve the chosen check, no duplicate signatures. */
function routeDecision(
  d: { checkId: string; tool: string },
  eligible: CheckDefinition[],
  executed: Set<string>,
): { message: string; duplicate: boolean } | null {
  if (!ToolName.safeParse(d.tool).success) return { message: 'tool is not whitelisted', duplicate: false };
  const check = eligible.find((c) => c.id === d.checkId);
  if (!check) return { message: 'check is not eligible', duplicate: false };
  if (!check.tools.includes(d.tool as ToolName)) return { message: 'tool cannot produce this check', duplicate: false };
  if (executed.has(`${d.checkId}:${d.tool}`)) return { message: 'duplicate tool/check signature', duplicate: true };
  return null;
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
