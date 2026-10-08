import { describe, expect, it } from 'vitest';
import { RateLimitedError, TelegramConversation, type Sender } from '../src/telegram/conversation';
import type { Button } from '../src/telegram/bot-copy';

const me: Sender = { telegramUserId: '42', chatId: '42', username: 'farrel' };
const CLAIM = 'BBCA growth kuat dan dividennya stabil, layak dikoleksi.';

function setup(opts: { linked?: boolean; busy?: boolean; startError?: Error; imageText?: string } = {}) {
  const sent: { text: string; buttons: Button[][] }[] = [];
  let linked = opts.linked ?? true;
  const started: string[] = [];
  const watched: string[] = [];
  const chosen: string[] = [];
  const convo = new TelegramConversation({
    port: { send: async (_chat, text, buttons = []) => { sent.push({ text, buttons }); }, downloadPhoto: async () => ({ base64: 'aGk=', mimeType: 'image/jpeg' }) },
    codes: { consume: async (code) => (code === 'good-code-0123456789' ? 'user-1' : null) },
    links: {
      byTelegramUser: async () => (linked ? { userId: 'user-1', userName: 'Farrel', chatId: '42', username: 'farrel', linkedAt: new Date() } : null),
      link: async () => { linked = true; },
      unlinkTelegram: async () => { linked = false; },
    },
    checks: {
      start: async (text) => { if (opts.startError) throw opts.startError; started.push(text); return 'sess-1'; },
      readImage: async () => opts.imageText ?? CLAIM,
      recent: async () => [{ id: 'sess-0', text: 'TLKM dividen tinggi', status: 'COMPLETED' }],
    },
    watcher: { isBusy: () => opts.busy ?? false, watch: (id) => { watched.push(id); }, choose: async (_chat, data) => { chosen.push(data); } },
    webUrl: 'https://counterpoint.app',
  });
  return { convo, sent, started, watched, chosen, last: () => sent.at(-1)!, isLinked: () => linked };
}

describe('TelegramConversation', () => {
  it('links the account from a valid start code and shows the menu', async () => {
    const t = setup({ linked: false });
    await t.convo.onStart(me, 'good-code-0123456789');
    expect(t.isLinked()).toBe(true);
    expect(t.sent[0]!.text).toBe('Terhubung sebagai Farrel ✅');
    expect(t.last().buttons.flat().map((b) => b.data)).toEqual(['menu:check', 'menu:history', 'menu:help']);
  });

  it('rejects an unknown or expired code', async () => {
    const t = setup({ linked: false });
    await t.convo.onStart(me, 'stale-code-0123456789');
    expect(t.isLinked()).toBe(false);
    expect(t.last().text).toContain('kedaluwarsa');
  });

  it('tells an unlinked chat to link first and never starts a check', async () => {
    const t = setup({ linked: false });
    await t.convo.onText(me, CLAIM);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('belum terhubung');
    expect(t.last().buttons.flat()[0]!.url).toBe('https://counterpoint.app/integrations');
  });

  it('starts a check from text, links to it and hands it to the watcher', async () => {
    const t = setup();
    await t.convo.onText(me, `  ${CLAIM}  `);
    expect(t.started).toEqual([CLAIM]);
    expect(t.watched).toEqual(['sess-1']);
    expect(t.last().buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/sess-1');
  });

  it('rejects text outside 10 to 2000 characters', async () => {
    const t = setup();
    await t.convo.onText(me, 'BBCA naik');
    expect(t.last().text).toContain('Minimal 10');
    await t.convo.onText(me, 'x'.repeat(2001));
    expect(t.last().text).toContain('Maksimal 2000');
    expect(t.started).toEqual([]);
  });

  it('allows one running check per chat', async () => {
    const t = setup({ busy: true });
    await t.convo.onText(me, CLAIM);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('Tunggu');
  });

  it('explains the rate limit', async () => {
    const t = setup({ startError: new RateLimitedError() });
    await t.convo.onText(me, CLAIM);
    expect(t.last().text).toContain('Batas pemeriksaan');
  });

  it('answers an unknown command with help instead of starting a check', async () => {
    const t = setup();
    await t.convo.onText(me, '/apaini sesuatu yang panjang sekali');
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain('Cara pakai');
  });

  it('reads a screenshot and checks the text only after confirmation', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 200_000);
    expect(t.started).toEqual([]);
    expect(t.last().text).toContain(CLAIM);
    await t.convo.onButton(me, 'img:go');
    expect(t.started).toEqual([CLAIM]);
    await t.convo.onButton(me, 'img:go');
    expect(t.last().text).toContain('sudah tidak tersedia');
  });

  it('drops the screenshot text on cancel', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 200_000);
    await t.convo.onButton(me, 'img:x');
    expect(t.last().text).toBe('Dibatalkan.');
    await t.convo.onButton(me, 'img:go');
    expect(t.started).toEqual([]);
  });

  it('refuses photos over 4 MB without downloading them', async () => {
    const t = setup();
    await t.convo.onPhoto(me, 'file-1', 5 * 1024 * 1024);
    expect(t.last().text).toContain('terlalu besar');
  });

  it('passes ticker buttons to the watcher', async () => {
    const t = setup();
    await t.convo.onButton(me, 'tk:abc:1');
    expect(t.chosen).toEqual(['tk:abc:1']);
  });

  it('unlinks with /putuskan', async () => {
    const t = setup();
    await t.convo.onUnlink(me);
    expect(t.isLinked()).toBe(false);
    expect(t.last().text).toContain('diputuskan');
  });

  it('lists recent checks', async () => {
    const t = setup();
    await t.convo.onButton(me, 'menu:history');
    expect(t.last().text).toContain('https://counterpoint.app/t/sess-0');
  });
});
