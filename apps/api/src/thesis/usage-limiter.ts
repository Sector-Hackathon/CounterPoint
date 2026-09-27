import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Protects paid Sectors/LLM credits on a public deployment: a per-IP hourly limit (in memory,
 * per instance) and a global daily cap on new theses (counted in the database, survives restarts).
 */
@Injectable()
export class UsageLimiter {
  private readonly perHour = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
  private readonly dailyCap = Number(process.env.DAILY_THESIS_CAP ?? 200);
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  async check(ip: string): Promise<void> {
    const now = Date.now();
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= this.perHour) {
      throw new HttpException(
        `Rate limit reached: at most ${this.perHour} theses per hour. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const today = await this.prisma.thesisSession.count({ where: { createdAt: { gte: startOfDay } } });
    if (today >= this.dailyCap) {
      throw new HttpException('Daily usage limit reached for this demo. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    this.hits.set(ip, recent);
  }
}
