import type { LlmService } from '../llm/llm.service';
import { PLANNER_SYSTEM, PlannerSchema } from '../llm/prompts';
import type { Planner, PlannerDecision, PlannerInput } from './engine';

/** LLM planner. Its decisions still pass through the engine's router and stop controller. */
export class LlmPlanner implements Planner {
  readonly name: string;

  constructor(private readonly llm: LlmService) {
    this.name = `llm:${llm.model}`;
  }

  async decide(input: PlannerInput): Promise<PlannerDecision> {
    const user = JSON.stringify(
      {
        claim: input.claim,
        contract: input.contractId,
        eligible_checks: input.eligible,
        check_states: input.states.map((s) => ({ id: s.checkId, kind: s.kind, status: s.status, outcome: s.outcome, note: s.note })),
        contradictions: input.contradictions,
        budget: input.budget,
        history: input.history,
      },
      null,
      2,
    );
    const out = await this.llm.parse(PlannerSchema, { system: PLANNER_SYSTEM, user, effort: 'low', maxTokens: 2000, label: 'planner' });
    if (out.action === 'stop') return { action: 'stop', reason: out.reason };
    return { action: 'investigate', checkId: out.check_id ?? '', tool: out.tool ?? '', reason: out.reason };
  }
}
