import { describe, expect, it } from 'vitest';
import { LlmPlanner } from '../src/investigation/llm-planner';
import type { PlannerInput } from '../src/investigation/engine';

const fakeLlm = (out: unknown) => {
  const calls: { user: string }[] = [];
  const llm = { model: 'fake/m', available: true, parse: async (_s: unknown, o: { user: string }) => (calls.push(o), out) };
  return { llm: llm as never, calls };
};

const input: PlannerInput = {
  claim: { normalizedText: 'x', claimType: 'ABSOLUTE_GROWTH', ticker: 'BBCA' },
  contractId: 'absolute-growth-v2',
  eligible: [
    {
      checkId: 'base_effect', kind: 'counter', phase: 'counterpoint', description: 'd', hypothesis: 'Is this a rebound?',
      tools: ['get_annual_financials'], triggeredBy: null,
    },
  ],
  states: [],
  contradictions: [],
  budget: { toolCallsUsed: 3, toolCallsLeft: 5, replansLeft: 2 },
  history: [],
};

describe('LlmPlanner', () => {
  it('passes the expectation through', async () => {
    const { llm } = fakeLlm({ action: 'investigate', check_id: 'base_effect', tool: 'get_annual_financials', reason: 'r', expectation: 'weakens' });
    expect(await new LlmPlanner(llm).decide(input)).toMatchObject({ action: 'investigate', expectation: 'weakens' });
  });

  it('treats a missing expectation as null', async () => {
    const { llm } = fakeLlm({ action: 'investigate', check_id: 'base_effect', tool: 'get_annual_financials', reason: 'r', expectation: null });
    expect(await new LlmPlanner(llm).decide(input)).toMatchObject({ expectation: null });
  });

  it('shows the model each eligible check phase and hypothesis', async () => {
    const { llm, calls } = fakeLlm({ action: 'stop', check_id: null, tool: null, reason: 'r', expectation: null });
    await new LlmPlanner(llm).decide(input);
    expect(calls[0]!.user).toContain('"phase": "counterpoint"');
    expect(calls[0]!.user).toContain('Is this a rebound?');
  });
});
