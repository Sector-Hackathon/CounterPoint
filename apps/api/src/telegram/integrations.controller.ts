import { Controller, Delete, Get, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.service';
import { TelegramBot } from './telegram.bot';
import { LinkCodeService } from './link-codes';
import { TelegramLinkService } from './telegram-links';

@Controller('integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(
    private readonly bot: TelegramBot,
    private readonly codes: LinkCodeService,
    private readonly links: TelegramLinkService,
  ) {}

  @Get()
  async status(@Req() request: AuthRequest) {
    const link = await this.links.byUser(request.user.id);
    return {
      telegram: {
        configured: this.bot.ready,
        botUsername: this.bot.ready ? this.bot.username : null,
        linked: link ? { username: link.username, linkedAt: link.linkedAt.toISOString() } : null,
      },
      discord: { configured: false },
    };
  }

  @Post('telegram/link')
  async link(@Req() request: AuthRequest) {
    if (!this.bot.ready || !this.bot.username) throw new ServiceUnavailableException('Bot Telegram belum dikonfigurasi di server ini.');
    const { code, expiresAt } = await this.codes.create(request.user.id);
    return { url: `https://t.me/${this.bot.username}?start=${code}`, expiresAt: expiresAt.toISOString() };
  }

  /** Returns a body (not 204) because the web client always parses JSON. */
  @Delete('telegram')
  async unlink(@Req() request: AuthRequest) {
    await this.links.unlinkUser(request.user.id);
    return { ok: true };
  }
}
