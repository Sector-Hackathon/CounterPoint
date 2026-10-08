import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LINK_CODE_TTL_MS, LinkCodeService } from '../src/telegram/link-codes';

interface Row { codeHash: string; userId: string; expiresAt: Date; usedAt: Date | null }

/** Just enough of Prisma's linkCode delegate for the service, kept in memory. */
function fakePrisma() {
  const rows: Row[] = [];
  const matches = (r: Row, where: Record<string, unknown>) =>
    (where.codeHash === undefined || r.codeHash === where.codeHash) &&
    (where.userId === undefined || r.userId === where.userId) &&
    (!('usedAt' in where) || r.usedAt === where.usedAt) &&
    (where.expiresAt === undefined || r.expiresAt > (where.expiresAt as { gt: Date }).gt);
  const linkCode = {
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
    create: async ({ data }: { data: Omit<Row, 'usedAt'> }) => { rows.push({ ...data, usedAt: null }); return data; },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { usedAt: Date } }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => (r.usedAt = data.usedAt));
      return { count: hit.length };
    },
    findUnique: async ({ where }: { where: { codeHash: string } }) => rows.find((r) => r.codeHash === where.codeHash) ?? null,
  };
  return { rows, prisma: { linkCode, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } };
}

describe('LinkCodeService', () => {
  it('stores only a hash of a url-safe code that fits a Telegram start parameter', async () => {
    const { rows, prisma } = fakePrisma();
    const { code, expiresAt } = await new LinkCodeService(prisma as never).create('u1', new Date(0));
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(expiresAt.getTime()).toBe(LINK_CODE_TTL_MS);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.codeHash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it('accepts a code once', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const { code } = await service.create('u1');
    expect(await service.consume(code)).toBe('u1');
    expect(await service.consume(code)).toBeNull();
  });

  it('rejects an expired code', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const { code } = await service.create('u1', new Date(0));
    expect(await service.consume(code, new Date(LINK_CODE_TTL_MS + 1))).toBeNull();
  });

  it('invalidates older unused codes when a new one is made', async () => {
    const { prisma } = fakePrisma();
    const service = new LinkCodeService(prisma as never);
    const first = await service.create('u1');
    const second = await service.create('u1');
    expect(await service.consume(first.code)).toBeNull();
    expect(await service.consume(second.code)).toBe('u1');
  });

  it('rejects malformed input without querying', async () => {
    const { prisma } = fakePrisma();
    expect(await new LinkCodeService(prisma as never).consume('../../etc')).toBeNull();
  });
});
