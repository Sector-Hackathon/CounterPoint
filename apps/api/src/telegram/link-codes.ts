import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const LINK_CODE_TTL_MS = 10 * 60_000;
const digest = (code: string) => createHash('sha256').update(code).digest('hex');

/** One-time codes that link a Telegram account to a signed-in user. Only hashes are stored. */
@Injectable()
export class LinkCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** A new code replaces the user's earlier unused ones. 24 bytes base64url = 32 chars, within Telegram's 64-char start parameter. */
  async create(userId: string, now = new Date()): Promise<{ code: string; expiresAt: Date }> {
    const code = randomBytes(24).toString('base64url');
    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.linkCode.deleteMany({ where: { userId, usedAt: null } }),
      this.prisma.linkCode.create({ data: { codeHash: digest(code), userId, expiresAt } }),
    ]);
    return { code, expiresAt };
  }

  /** Marks the code used and returns its user, or null if unknown, used or expired. The conditional update makes it single-use under races. */
  async consume(code: string, now = new Date()): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return null;
    const codeHash = digest(code);
    const updated = await this.prisma.linkCode.updateMany({ where: { codeHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (updated.count === 0) return null;
    const row = await this.prisma.linkCode.findUnique({ where: { codeHash } });
    return row?.userId ?? null;
  }
}
