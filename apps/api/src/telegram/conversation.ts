import { Logger } from '@nestjs/common';
import { COPY, MENU, historyList, type Button, type ChatPort } from './bot-copy';
import type { LinkedAccount } from './telegram-links';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PENDING_TTL_MS = 15 * 60_000;

export interface Sender { telegramUserId: string; chatId: string; username: string | null }

export class RateLimitedError extends Error {
  constructor() { super('rate limited'); this.name = 'RateLimitedError'; }
}

export interface Checks {
  /** Applies the usage limit and creates the check; throws RateLimitedError when over the limit. Returns the session id. */
  start(text: string, userId: string, chatId: string, limiterKey: string): Promise<string>;
  /** Applies the usage limit (throws RateLimitedError), then transcribes the screenshot. */
  readImage(base64: string, mimeType: string, limiterKey: string): Promise<string>;
  recent(userId: string): Promise<{ id: string; text: string; status: string }[]>;
}

export interface ConversationDeps {
  port: ChatPort;
  codes: { consume(code: string): Promise<string | null> };
  links: {
    byTelegramUser(telegramUserId: string): Promise<LinkedAccount | null>;
    link(userId: string, telegram: { telegramUserId: string; chatId: string; username: string | null }): Promise<void>;
    unlinkTelegram(telegramUserId: string): Promise<void>;
  };
  checks: Checks;
  watcher: { isBusy(chatId: string): boolean; watch(sessionId: string, chatId: string): void; choose(chatId: string, data: string): Promise<void> };
  webUrl: string;
}

/** Platform-neutral bot behaviour. Telegram specifics live in TelegramBot. */
export class TelegramConversation {
  private readonly logger = new Logger(TelegramConversation.name);
  private readonly pendingImages = new Map<string, { text: string; expires: number }>();

  constructor(private readonly deps: ConversationDeps) {}

  private send(chatId: string, text: string, buttons?: Button[][]) {
    return this.deps.port.send(chatId, text, buttons);
  }

  private integrationsButton(): Button[][] {
    return [[{ text: 'Buka halaman Integrasi ↗', url: `${this.deps.webUrl}/integrations` }]];
  }

  /** Returns the linked account, or tells the chat to link first. */
  private async account(from: Sender): Promise<LinkedAccount | null> {
    const account = await this.deps.links.byTelegramUser(from.telegramUserId);
    if (!account) await this.send(from.chatId, COPY.notLinked, this.integrationsButton());
    return account;
  }

  async onStart(from: Sender, payload?: string): Promise<void> {
    if (payload) {
      const userId = await this.deps.codes.consume(payload);
      if (!userId) return this.send(from.chatId, COPY.codeInvalid, this.integrationsButton());
      await this.deps.links.link(userId, from);
      const account = await this.deps.links.byTelegramUser(from.telegramUserId);
      await this.send(from.chatId, COPY.linked(account?.userName ?? 'akunmu'));
      return this.send(from.chatId, COPY.askClaim, MENU);
    }
    const account = await this.account(from);
    if (account) await this.send(from.chatId, COPY.welcome(account.userName), MENU);
  }

  async onText(from: Sender, raw: string): Promise<void> {
    if (raw.trim().startsWith('/')) return this.onHelp(from);
    const account = await this.account(from);
    if (!account) return;
    const text = raw.trim();
    if (text.length < 10) return this.send(from.chatId, COPY.tooShort);
    if (text.length > 2000) return this.send(from.chatId, COPY.tooLong);
    await this.startCheck(account, from, text);
  }

  async onPhoto(from: Sender, fileId: string, size: number): Promise<void> {
    const account = await this.account(from);
    if (!account) return;
    if (size > MAX_PHOTO_BYTES) return this.send(from.chatId, COPY.imageTooLarge);
    await this.send(from.chatId, COPY.readingImage);
    let text = '';
    try {
      const photo = await this.deps.port.downloadPhoto(fileId);
      text = (await this.deps.checks.readImage(photo.base64, photo.mimeType, `tg:${from.telegramUserId}`)).trim().slice(0, 2000);
    } catch (err) {
      if (err instanceof RateLimitedError) return this.send(from.chatId, COPY.rateLimited);
      this.logger.warn(`screenshot read failed: ${(err as Error).message}`);
    }
    if (text.length < 10) return this.send(from.chatId, COPY.imageFailed);
    this.pendingImages.set(from.chatId, { text, expires: Date.now() + PENDING_TTL_MS });
    await this.send(from.chatId, COPY.imageRead(text), [[{ text: 'Periksa ini', data: 'img:go' }, { text: 'Batal', data: 'img:x' }]]);
  }

  async onButton(from: Sender, data: string): Promise<void> {
    if (data.startsWith('tk:')) return this.deps.watcher.choose(from.chatId, data);
    if (data === 'menu:help') return this.onHelp(from);
    if (data === 'img:x') {
      this.pendingImages.delete(from.chatId);
      return this.send(from.chatId, COPY.cancelled);
    }
    const account = await this.account(from);
    if (!account) return;
    if (data === 'menu:check') return this.send(from.chatId, COPY.askClaim);
    if (data === 'menu:history') return this.onHistory(from);
    if (data === 'img:go') {
      const pending = this.pendingImages.get(from.chatId);
      this.pendingImages.delete(from.chatId);
      if (!pending || pending.expires < Date.now()) return this.send(from.chatId, COPY.noPending);
      await this.startCheck(account, from, pending.text);
    }
  }

  async onUnlink(from: Sender): Promise<void> {
    await this.deps.links.unlinkTelegram(from.telegramUserId);
    await this.send(from.chatId, COPY.unlinked);
  }

  async onHistory(from: Sender): Promise<void> {
    const account = await this.account(from);
    if (!account) return;
    await this.send(from.chatId, historyList(await this.deps.checks.recent(account.userId), this.deps.webUrl));
  }

  onHelp(from: Sender): Promise<void> {
    return this.send(from.chatId, COPY.help, [[{ text: 'Buka Counterpoint ↗', url: this.deps.webUrl }]]);
  }

  private async startCheck(account: LinkedAccount, from: Sender, text: string): Promise<void> {
    if (this.deps.watcher.isBusy(from.chatId)) return this.send(from.chatId, COPY.busy);
    let sessionId: string;
    try {
      sessionId = await this.deps.checks.start(text, account.userId, from.chatId, `tg:${from.telegramUserId}`);
    } catch (err) {
      if (err instanceof RateLimitedError) return this.send(from.chatId, COPY.rateLimited);
      this.logger.error(`could not start a Telegram check: ${(err as Error).message}`);
      return this.send(from.chatId, COPY.startFailed);
    }
    await this.send(from.chatId, COPY.checking, [[{ text: 'Pantau di website ↗', url: `${this.deps.webUrl}/t/${sessionId}` }]]);
    this.deps.watcher.watch(sessionId, from.chatId);
  }
}
