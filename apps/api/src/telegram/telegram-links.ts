import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LinkedAccount { userId: string; userName: string; chatId: string; username: string | null; linkedAt: Date }

/** One Telegram account per user and one user per Telegram account. */
@Injectable()
export class TelegramLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async byTelegramUser(telegramUserId: string): Promise<LinkedAccount | null> {
    const row = await this.prisma.telegramLink.findUnique({ where: { telegramUserId }, include: { user: { select: { name: true } } } });
    return row ? { userId: row.userId, userName: row.user.name, chatId: row.chatId, username: row.username, linkedAt: row.linkedAt } : null;
  }

  byUser(userId: string): Promise<{ username: string | null; linkedAt: Date } | null> {
    return this.prisma.telegramLink.findUnique({ where: { userId }, select: { username: true, linkedAt: true } });
  }

  /** Replaces any earlier link on either side. */
  async link(userId: string, telegram: { telegramUserId: string; chatId: string; username: string | null }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.telegramLink.deleteMany({ where: { OR: [{ userId }, { telegramUserId: telegram.telegramUserId }] } }),
      this.prisma.telegramLink.create({ data: { userId, ...telegram } }),
    ]);
  }

  async unlinkUser(userId: string): Promise<void> {
    await this.prisma.telegramLink.deleteMany({ where: { userId } });
  }

  async unlinkTelegram(telegramUserId: string): Promise<void> {
    await this.prisma.telegramLink.deleteMany({ where: { telegramUserId } });
  }
}
