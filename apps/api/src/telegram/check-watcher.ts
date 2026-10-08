import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Observable, Subscription } from 'rxjs';
import type { SessionEvent } from '../events/events.types';
import { COPY, scoreboard, type Button, type ChatPort, type ScoreLine } from './bot-copy';

export const WATCH_TIMEOUT_MS = 15 * 60_000;
const FINAL_OK = new Set(['COMPLETED', 'PARTIAL']);

export interface PendingEntity { id: string; mention: string; candidates: { ticker: string; name: string }[] }

export interface WatchedSessions {
  ambiguous(sessionId: string): Promise<PendingEntity[]>;
  confirm(sessionId: string, entityId: string, ticker: string): Promise<void>;
  startInvestigation(sessionId: string): Promise<boolean>;
  scoreboard(sessionId: string): Promise<{ tickers: string[]; status: string; claims: ScoreLine[] }>;
  unfinishedTelegram(): Promise<{ id: string; telegramChatId: string }[]>;
}

export interface WatcherDeps {
  port: ChatPort;
  events: { stream(sessionId: string): Observable<{ data: SessionEvent }> };
  sessions: WatchedSessions;
  webUrl: string;
  timeoutMs: number;
}

interface Watch { sessionId: string; chatId: string; sub: Subscription | null; timer: NodeJS.Timeout | null; done: boolean; prompted: boolean }
interface Prompt { sessionId: string; chatId: string; entityId: string; tickers: string[] }

/** Follows each check started from Telegram, from extraction to the scoreboard. One watch per chat. */
export class CheckWatcher {
  private readonly logger = new Logger(CheckWatcher.name);
  private readonly byChat = new Map<string, Watch>();
  private readonly prompts = new Map<string, Prompt>();

  constructor(private readonly deps: WatcherDeps) {}

  isBusy(chatId: string): boolean {
    return this.byChat.has(chatId);
  }

  watch(sessionId: string, chatId: string): void {
    if (this.byChat.get(chatId)?.sessionId === sessionId) return;
    const watch: Watch = { sessionId, chatId, sub: null, timer: null, done: false, prompted: false };
    watch.timer = setTimeout(() => void this.finish(watch, 'timeout'), this.deps.timeoutMs);
    this.byChat.set(chatId, watch);
    watch.sub = this.deps.events.stream(sessionId).subscribe({
      next: ({ data }) => void this.onEvent(watch, data).catch((err: Error) => this.logger.error(`watch ${sessionId}: ${err.message}`)),
      error: (err: Error) => { this.logger.warn(`event stream for ${sessionId} ended: ${err.message}`); void this.finish(watch, 'quiet'); },
    });
  }

  /** Handles a `tk:<promptId>:<index>` button. Re-attaches the watch, so the investigation still starts after a timeout. */
  async choose(chatId: string, data: string): Promise<void> {
    const [, promptId, index] = data.split(':');
    const prompt = promptId ? this.prompts.get(promptId) : undefined;
    const ticker = prompt?.tickers[Number(index)];
    if (promptId) this.prompts.delete(promptId);
    // A stale button (company already picked on the website, or check finished) must not reset the check.
    const stillPending = prompt && prompt.chatId === chatId && ticker
      ? (await this.deps.sessions.ambiguous(prompt.sessionId)).some((e) => e.id === prompt.entityId)
      : false;
    if (!prompt || !ticker || !stillPending) {
      await this.deps.port.send(chatId, COPY.choiceExpired);
      return;
    }
    await this.deps.sessions.confirm(prompt.sessionId, prompt.entityId, ticker);
    await this.deps.port.send(chatId, COPY.chosen(ticker));
    this.watch(prompt.sessionId, chatId);
  }

  async resume(): Promise<void> {
    for (const row of await this.deps.sessions.unfinishedTelegram()) this.watch(row.id, row.telegramChatId);
  }

  stopAll(): void {
    for (const watch of [...this.byChat.values()]) void this.finish(watch, 'quiet');
  }

  private link(sessionId: string): Button[][] {
    return [[{ text: 'Buka analisis lengkap ↗', url: `${this.deps.webUrl}/t/${sessionId}` }]];
  }

  private async onEvent(watch: Watch, event: SessionEvent): Promise<void> {
    if (watch.done) return;
    // report.ready is published before the final status row is written, so the scoreboard waits for the status.
    if (event.type !== 'session.status') return;
    if (event.status === 'CLAIMS_EXTRACTED') {
      await this.deps.sessions.startInvestigation(watch.sessionId);
    } else if (event.status === 'AWAITING_CONFIRMATION' && !watch.prompted) {
      watch.prompted = true;
      await this.askTicker(watch);
    } else if (FINAL_OK.has(event.status)) {
      await this.finish(watch, 'ok', null, event.status);
    } else if (event.status === 'FAILED') {
      await this.finish(watch, 'failed', event.error);
    }
  }

  private async askTicker(watch: Watch): Promise<void> {
    const entities = (await this.deps.sessions.ambiguous(watch.sessionId)).filter((e) => e.candidates.length > 0);
    if (!entities.length) {
      await this.deps.port.send(watch.chatId, COPY.pickOnWeb, [[{ text: 'Pilih di website ↗', url: `${this.deps.webUrl}/t/${watch.sessionId}` }]]);
      return;
    }
    for (const entity of entities) {
      const promptId = randomBytes(6).toString('base64url');
      const options = entity.candidates.slice(0, 4);
      this.prompts.set(promptId, { sessionId: watch.sessionId, chatId: watch.chatId, entityId: entity.id, tickers: options.map((c) => c.ticker) });
      const buttons = options.map((c, i) => [{ text: `${c.ticker} · ${c.name}`, data: `tk:${promptId}:${i}` }]);
      await this.deps.port.send(watch.chatId, COPY.whichTicker(entity.mention), buttons);
    }
  }

  private async finish(watch: Watch, outcome: 'ok' | 'failed' | 'timeout' | 'quiet', reason: string | null = null, finalStatus?: string): Promise<void> {
    if (watch.done) return;
    watch.done = true;
    if (watch.timer) clearTimeout(watch.timer);
    watch.sub?.unsubscribe();
    if (this.byChat.get(watch.chatId) === watch) this.byChat.delete(watch.chatId);
    if (outcome === 'ok' || outcome === 'failed') {
      for (const [id, prompt] of this.prompts) if (prompt.sessionId === watch.sessionId) this.prompts.delete(id);
    }
    if (outcome === 'ok') {
      const board = await this.deps.sessions.scoreboard(watch.sessionId);
      await this.deps.port.send(watch.chatId, scoreboard({ ...board, status: finalStatus ?? board.status }), this.link(watch.sessionId));
    } else if (outcome === 'failed') {
      await this.deps.port.send(watch.chatId, COPY.failed(reason), this.link(watch.sessionId));
    } else if (outcome === 'timeout') {
      await this.deps.port.send(watch.chatId, COPY.timedOut, this.link(watch.sessionId));
    }
  }
}
