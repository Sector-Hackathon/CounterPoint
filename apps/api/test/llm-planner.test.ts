import { describe, expect, it } from 'vitest';
import { PlannerSchema } from '../src/llm/prompts';
import { LlmPlanner } from '../src/investigation/llm-planner';
import type { PlannerInput } from '../src/investigation/engine';

const fakeLlm = (out: unknown) => {
  const calls: { user: string; system: string }[] = [];
  const llm = { model: 'fake/m', available: true, parse: async (_s: unknown, o: { user: string; system: string }) => (calls.push(o), out) };
  return { llm: llm as never, calls };
};

const input: PlannerInput = {
  claim: { normalizedText: 'x', claimType: 'ABSOLUTE_GROWTH', ticker: 'BBCA' },
  contractId: 'absolute-growth-v2',
  eligible: [
    {
      checkId: 'base_effect', kind: 'counter', phase: 'counterpoint', description: 'd', hypothesis: 'Is this a rebound?',
      question: 'Is this a rebound?', rule: 'A base year that did not grow confirms a rebound.',
      tools: ['get_annual_financials'], triggeredBy: null,
    },
  ],
  states: [],
  contradictions: [],
  budget: { toolCallsUsed: 3, toolCallsLeft: 5, replansLeft: 2 },
  history: [],
};

describe('LlmPlanner', () => {
  it('returns the chosen check, tool and reason', async () => {
    const { llm } = fakeLlm({ action: 'investigate', check_id: 'base_effect', tool: 'get_annual_financials', reason: 'r' });
    expect(await new LlmPlanner(llm).decide(input)).toEqual({
      action: 'investigate',
      checkId: 'base_effect',
      tool: 'get_annual_financials',
      reason: 'r',
    });
  });

  it('shows the model each eligible check with its phase, question and decision rule', async () => {
    const { llm, calls } = fakeLlm({ action: 'stop', check_id: null, tool: null, reason: 'r' });
    await new LlmPlanner(llm).decide(input);
    expect(calls[0]!.user).toContain('"phase": "counterpoint"');
    expect(calls[0]!.user).toContain('Is this a rebound?');
    expect(calls[0]!.user).toContain('A base year that did not grow confirms a rebound.');
  });

  it('asks for no prediction at all (phase 3)', async () => {
    const { llm, calls } = fakeLlm({ action: 'stop', check_id: null, tool: null, reason: 'r' });
    await new LlmPlanner(llm).decide(input);
    expect(Object.keys(PlannerSchema.shape)).toEqual(['action', 'check_id', 'tool', 'reason']);
    expect(calls[0]!.system).not.toMatch(/your (honest )?prediction|predict (its|the) outcome/i);
    expect(calls[0]!.system).toMatch(/do not guess or predict/i);
  });
});
