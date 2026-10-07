import { describe, expect, it, vi } from 'vitest';
import { FixtureSectorsDataSource, DEV_FIXTURE } from '@counterpoint/sectors';
import { InvestigationService } from '../src/investigation/investigation.service';
const row = { id: 'c', sessionId: 's', originalText: 'growth kuat', normalizedText: 'strong growth', ticker: 'BBRI', claimType: 'ABSOLUTE_GROWTH', comparisonType: 'HISTORICAL', timeScope: null, verifiability: 'YES', contractId: 'absolute-growth-v2', assessment: null, scopeNote: null, direction: 'bullish', spanStart: null, spanEnd: null };
function setup(failFinal = false) {
  const traces = new Map<string, Record<string, unknown>>();
  const prisma = {
    claim: { findMany: vi.fn(async () => [row]), update: vi.fn(async () => ({})) },
    evidenceItem: { createMany: vi.fn(async () => ({})) },
    thesisSession: { update: vi.fn(async () => ({})) },
    executionTrace: {
      create: vi.fn(async ({ data }) => { traces.set(data.id, data); return data; }),
      upsert: vi.fn(async ({ where, create, update }) => { if (failFinal && traces.has(where.id)) throw new Error('DB write failed'); const value = traces.has(where.id) ? update : create; traces.set(where.id, value); return value; }),
      updateMany: vi.fn(async ({ data }) => { for (const [id, value] of traces) if (value.resultStatus === 'RUNNING') traces.set(id, { ...value, ...data }); return {}; }),
    },
  };
  const events = { publish: vi.fn() };
  const service = new InvestigationService(prisma as never, { available: false } as never, { build: async () => ({ id: 'r' }) } as never, new FixtureSectorsDataSource(DEV_FIXTURE), events as never);
  return { prisma, traces, events, run: () => (service as unknown as { run(id: string): Promise<void> }).run('s') };
}
describe('investigation trace persistence', () => {
  it('creates running rows then upserts their final values', async () => {
    const { prisma, traces, run } = setup(); await run();
    expect(prisma.executionTrace.create).toHaveBeenCalled(); expect(prisma.executionTrace.upsert).toHaveBeenCalled();
    expect([...traces.values()].some((value) => value.resultStatus === 'RUNNING')).toBe(false);
    expect(prisma.thesisSession.update).toHaveBeenLastCalledWith({ where: { id: 's' }, data: { status: 'COMPLETED' } });
  });
  it('closes unfinished rows and marks the session failed after a persistence error', async () => {
    const { prisma, traces, run } = setup(true); await run();
    expect(prisma.executionTrace.updateMany).toHaveBeenCalled(); expect([...traces.values()].some((value) => value.resultStatus === 'RUNNING')).toBe(false);
    expect(prisma.thesisSession.update).toHaveBeenLastCalledWith({ where: { id: 's' }, data: { status: 'FAILED', error: 'DB write failed' } });
  });
});
