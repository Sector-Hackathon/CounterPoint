import { describe, expect, it } from 'vitest';
import { IntegrationsController } from '../src/telegram/integrations.controller';

const request = { user: { id: 'user-1', name: 'Farrel', email: 'f@x.id' } } as never;

function controller(opts: { ready?: boolean; linked?: boolean } = {}) {
  const unlinked: string[] = [];
  const c = new IntegrationsController(
    { ready: opts.ready ?? true, username: opts.ready === false ? null : 'CounterpointDevBot' } as never,
    { create: async () => ({ code: 'abc_DEF-123', expiresAt: new Date('2026-10-08T00:10:00Z') }) } as never,
    {
      byUser: async () => (opts.linked ? { username: 'farrel', linkedAt: new Date('2026-10-08T00:00:00Z') } : null),
      unlinkUser: async (id: string) => { unlinked.push(id); },
    } as never,
  );
  return { c, unlinked };
}

describe('IntegrationsController', () => {
  it('reports a bot that is not configured, and refuses to make codes', async () => {
    const { c } = controller({ ready: false });
    expect((await c.status(request)).telegram).toEqual({ configured: false, botUsername: null, linked: null });
    await expect(c.link(request)).rejects.toMatchObject({ status: 503 });
  });

  it('returns a t.me start link for the signed-in user', async () => {
    const { c } = controller();
    expect(await c.link(request)).toEqual({ url: 'https://t.me/CounterpointDevBot?start=abc_DEF-123', expiresAt: '2026-10-08T00:10:00.000Z' });
  });

  it('shows the linked account and unlinks it', async () => {
    const { c, unlinked } = controller({ linked: true });
    expect((await c.status(request)).telegram.linked).toEqual({ username: 'farrel', linkedAt: '2026-10-08T00:00:00.000Z' });
    expect(await c.unlink(request)).toEqual({ ok: true });
    expect(unlinked).toEqual(['user-1']);
  });
});
