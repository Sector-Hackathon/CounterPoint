import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { CheckWatcher, type PendingEntity } from '../src/telegram/check-watcher';
import type { Button } from '../src/telegram/bot-copy';
import type { SessionEvent } from '../src/events/events.types';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { entities?: PendingEntity[]; timeoutMs?: number; storedStatus?: string } = {}) {
  const state = { entities: opts.entities ?? [{ id: 'ent-1', mention: 'BCA', candidates: [{ ticker: 'BBCA', name: 'Bank Central Asia' }, { ticker: 'BACA', name: 'Bank Capital' }] }] as PendingEntity[] };
  const streams = new Map<string, Subject<{ data: SessionEvent }>>();
  const sent: { chatId: string; text: string; buttons: Button[][] }[] = [];
  const started: string[] = [];
  const confirmed: string[] = [];
  const watcher = new CheckWatcher({
    port: { send: async (chatId, text, buttons = []) => { sent.push({ chatId, text, buttons }); }, downloadPhoto: async () => { throw new Error('unused'); } },
    events: { stream: (id) => { const s = new Subject<{ data: SessionEvent }>(); streams.set(id, s); return s; } },
    sessions: {
      ambiguous: async () => state.entities,
      confirm: async (_id, _entity, ticker) => { confirmed.push(ticker); },
      startInvestigation: async (id) => { started.push(id); return true; },
      scoreboard: async () => ({ tickers: ['TLKM'], status: opts.storedStatus ?? 'COMPLETED', claims: [{ text: 'Dividen tinggi', assessment: 'PARTIALLY_SUPPORTED' }] }),
      unfinishedTelegram: async () => [{ id: 'old', telegramChatId: '7' }],
    },
    webUrl: 'https://counterpoint.app',
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
  const status = (id: string, value: string, error: string | null = null) =>
    streams.get(id)!.next({ data: { id: `status:${value}`, type: 'session.status', status: value, error } });
  const reportReady = (id: string) => streams.get(id)!.next({ data: { id: 'report', type: 'report.ready', reportId: 'r1' } });
  return { watcher, sent, started, confirmed, status, reportReady, streams, state };
}

describe('CheckWatcher', () => {
  it('starts the investigation once claims are extracted', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'CLAIMS_EXTRACTED');
    await flush();
    expect(t.started).toEqual(['s1']);
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('asks which ticker with buttons and confirms the one tapped', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const prompt = t.sent.at(-1)!;
    expect(prompt.text).toContain('"BCA"');
    expect(prompt.buttons.flat().map((b) => b.text)).toEqual(['BBCA · Bank Central Asia', 'BACA · Bank Capital']);
    await t.watcher.choose('42', prompt.buttons[0]![0]!.data!);
    expect(t.confirmed).toEqual(['BBCA']);
    expect(t.sent.at(-1)!.text).toContain('Dipilih: BBCA');
  });

  it('ignores a ticker choice from another chat', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    await t.watcher.choose('99', t.sent.at(-1)!.buttons[0]![0]!.data!);
    expect(t.confirmed).toEqual([]);
    expect(t.sent.at(-1)!.text).toContain('tidak berlaku');
  });

  it('sends the user to the website when no candidates are known, and keeps watching', async () => {
    const t = setup({ entities: [{ id: 'ent-1', mention: 'XYZ', candidates: [] }] });
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    expect(t.sent.at(-1)!.text).toContain('Pilih sahamnya di website');
    expect(t.sent.at(-1)!.buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/s1');
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('sends one scoreboard with a link when the check completes, then frees the chat', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.reportReady('s1');
    t.status('s1', 'COMPLETED');
    await flush();
    const boards = t.sent.filter((m) => m.text.startsWith('✅'));
    expect(boards).toHaveLength(1);
    expect(boards[0]!.buttons.flat()[0]!.url).toBe('https://counterpoint.app/t/s1');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('reports a failure with its reason', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'FAILED', 'Sectors tidak merespons');
    await flush();
    expect(t.sent.at(-1)!.text).toBe('Pemeriksaan terhenti: Sectors tidak merespons');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('gives up after the timeout and points to the website', async () => {
    const t = setup({ timeoutMs: 5 });
    t.watcher.watch('s1', '42');
    await new Promise((r) => setTimeout(r, 20));
    expect(t.sent.at(-1)!.text).toContain('Cek hasilnya di website');
    expect(t.watcher.isBusy('42')).toBe(false);
  });

  it('re-attaches when a ticker is chosen after the watch timed out', async () => {
    const t = setup({ timeoutMs: 5 });
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const data = t.sent.at(-1)!.buttons[0]![0]!.data!;
    await new Promise((r) => setTimeout(r, 20));
    expect(t.watcher.isBusy('42')).toBe(false);
    await t.watcher.choose('42', data);
    expect(t.watcher.isBusy('42')).toBe(true);
  });

  it('re-attaches to unfinished Telegram checks on boot', async () => {
    const t = setup();
    await t.watcher.resume();
    expect(t.watcher.isBusy('7')).toBe(true);
  });
  it('ignores a stale ticker button once the company is no longer pending', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const data = t.sent.at(-1)!.buttons[0]![0]!.data!;
    t.state.entities = []; // picked on the website meanwhile
    await t.watcher.choose('42', data);
    expect(t.confirmed).toEqual([]);
    expect(t.sent.at(-1)!.text).toContain('tidak berlaku');
  });

  it('forgets ticker buttons once the check is finished', async () => {
    const t = setup();
    t.watcher.watch('s1', '42');
    t.status('s1', 'AWAITING_CONFIRMATION');
    await flush();
    const data = t.sent.at(-1)!.buttons[0]![0]!.data!;
    t.status('s1', 'COMPLETED');
    await flush();
    await t.watcher.choose('42', data);
    expect(t.confirmed).toEqual([]);
  });

  it('waits for the final status and labels the scoreboard with it', async () => {
    const t = setup({ storedStatus: 'INVESTIGATING' }); // report.ready arrives before the status row is written
    t.watcher.watch('s1', '42');
    t.reportReady('s1');
    await flush();
    expect(t.sent.filter((m) => m.text.includes('Pemeriksaan selesai'))).toHaveLength(0);
    t.status('s1', 'PARTIAL');
    await flush();
    expect(t.sent.at(-1)!.text.startsWith('⚠️ Pemeriksaan selesai sebagian')).toBe(true);
  });
});
