import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Bot, GrammyError, type Context } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { ThesisService } from '../thesis/thesis.service';
import { InvestigationService } from '../investigation/investigation.service';
import { LlmService } from '../llm/llm.service';
import { UsageLimiter } from '../thesis/usage-limiter';
import { EventsService } from '../events/events.service';
import { renderMessage, type Button, type ChatPort } from './bot-copy';
import { CheckWatcher, WATCH_TIMEOUT_MS } from './check-watcher';
import { TelegramConversation, type Sender } from './conversation';
import { telegramChecks, telegramSessions } from './gateways';
import { LinkCodeService } from './link-codes';
import { TelegramLinkService } from './telegram-links';

/** Base URL for links in bot messages. */
export const webUrl = () => (process.env.PUBLIC_WEB_URL ?? process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000').trim().replace(/\/$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sender = (ctx: Context): Sender => ({ telegramUserId: String(ctx.from!.id), chatId: String(ctx.chat!.id), username: ctx.from!.username ?? null });

/** The only grammY-aware unit: long polling, update routing and the ChatPort. Off when TELEGRAM_BOT_TOKEN is unset. */
@Injectable()
export class TelegramBot implements ChatPort, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBot.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  private bot: Bot | null = null;
  private watcher: CheckWatcher | null = null;
  private running = false;
  username: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly theses: ThesisService,
    private readonly investigation: InvestigationService,
    private readonly llm: LlmService,
    private readonly limiter: UsageLimiter,
    private readonly events: EventsService,
    private readonly codes: LinkCodeService,
    private readonly links: TelegramLinkService,
  ) {}

  get ready(): boolean {
    return this.bot !== null && this.username !== null;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.token) {
      this.logger.log('TELEGRAM_BOT_TOKEN is not set; the Telegram bot is off');
      return;
    }
    const bot = new Bot(this.token);
    try {
      await bot.init();
    } catch (err) {
      this.logger.error(`Telegram bot could not start: ${(err as Error).message}`);
      return;
    }
    this.bot = bot;
    this.username = bot.botInfo.username;
    const url = webUrl();
    this.watcher = new CheckWatcher({ port: this, events: this.events, sessions: telegramSessions(this.prisma, this.theses, this.investigation), webUrl: url, timeoutMs: WATCH_TIMEOUT_MS });
    const convo = new TelegramConversation({ port: this, codes: this.codes, links: this.links, checks: telegramChecks(this.theses, this.llm, this.limiter), watcher: this.watcher, webUrl: url });
    this.route(bot, convo);
    this.running = true;
    void this.poll();
    void this.watcher.resume().catch((err: Error) => this.logger.error(`could not resume Telegram checks: ${err.message}`));
    this.logger.log(`Telegram bot @${this.username} is polling; links go to ${url}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    this.watcher?.stopAll();
    try { await this.bot?.stop(); } catch { /* not polling */ }
  }

  private route(bot: Bot, convo: TelegramConversation): void {
    bot.use(async (ctx, next) => { if (ctx.chat?.type === 'private' && ctx.from) await next(); });
    bot.command('start', (ctx) => convo.onStart(sender(ctx), ctx.match.trim() || undefined));
    bot.command('putuskan', (ctx) => convo.onUnlink(sender(ctx)));
    bot.command('riwayat', (ctx) => convo.onHistory(sender(ctx)));
    bot.command('bantuan', (ctx) => convo.onHelp(sender(ctx)));
    bot.on('message:photo', (ctx) => {
      const photo = ctx.message.photo.at(-1)!;
      return convo.onPhoto(sender(ctx), photo.file_id, photo.file_size ?? 0);
    });
    bot.on('message:text', (ctx) => convo.onText(sender(ctx), ctx.message.text));
    bot.on('callback_query:data', async (ctx) => {
      await ctx.answerCallbackQuery().catch(() => undefined);
      await convo.onButton(sender(ctx), ctx.callbackQuery.data);
    });
    bot.catch((err) => this.logger.error(`Telegram update failed: ${err.message}`));
  }

  /** Long polling. A 409 means another process polls this token (for example during a redeploy): back off and retry. */
  private async poll(): Promise<void> {
    let delay = 2_000;
    while (this.running && this.bot) {
      try {
        await this.bot.start({ allowed_updates: ['message', 'callback_query'] });
        return;
      } catch (err) {
        if (!this.running) return;
        const conflict = err instanceof GrammyError && err.error_code === 409;
        this.logger.warn(conflict ? 'Another process is polling this Telegram bot; retrying' : `Telegram polling stopped: ${(err as Error).message}; retrying`);
        await sleep(delay);
        delay = Math.min(delay * 2, 60_000);
      }
    }
  }

  async send(chatId: string, text: string, buttons: Button[][] = []): Promise<void> {
    if (!this.bot) return;
    const message = renderMessage(text, buttons);
    await this.bot.api.sendMessage(chatId, message.text, {
      link_preview_options: { is_disabled: true },
      ...(message.keyboard.length ? { reply_markup: { inline_keyboard: message.keyboard } } : {}),
    });
  }

  async downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
    if (!this.bot) throw new Error('Telegram bot is off');
    const file = await this.bot.api.getFile(fileId);
    // The file URL contains the bot token: never log it.
    const res = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`);
    if (!res.ok) throw new Error(`Telegram file download failed (${res.status})`);
    return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType: 'image/jpeg' };
  }
}
