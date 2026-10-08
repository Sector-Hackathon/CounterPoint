import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ThesisService } from '../thesis/thesis.service';
import type { InvestigationService } from '../investigation/investigation.service';
import type { LlmService } from '../llm/llm.service';
import type { UsageLimiter } from '../thesis/usage-limiter';
import { RateLimitedError, type Checks } from './conversation';
import type { PendingEntity, WatchedSessions } from './check-watcher';

/** Adapts the existing services to what the conversation needs. */
export function telegramChecks(theses: ThesisService, llm: LlmService, limiter: UsageLimiter): Checks {
  return {
    async start(text, userId, chatId, limiterKey) {
      try {
        await limiter.check(limiterKey);
      } catch (err) {
        if (err instanceof HttpException && err.getStatus() === 429) throw new RateLimitedError();
        throw err;
      }
      const session = await theses.create(text, userId, { source: 'telegram', telegramChatId: chatId });
      return session.id;
    },
    readImage: (base64, mimeType) => llm.readImageText(base64, mimeType),
    async recent(userId) {
      const page = await theses.history(userId, { page: 1, query: '', filter: 'all' });
      return page.items.slice(0, 5).map((item) => ({ id: item.id, text: item.text, status: item.status }));
    },
  };
}

/** Adapts the existing services to what the watcher needs. */
export function telegramSessions(prisma: PrismaService, theses: ThesisService, investigation: InvestigationService): WatchedSessions {
  return {
    async ambiguous(sessionId) {
      const rows = await prisma.entity.findMany({ where: { sessionId, resolutionStatus: { in: ['AMBIGUOUS', 'UNKNOWN'] } }, select: { id: true, mention: true, candidates: true } });
      return rows.map((row): PendingEntity => ({ id: row.id, mention: row.mention, candidates: row.candidates as unknown as PendingEntity['candidates'] }));
    },
    async confirm(sessionId, entityId, ticker) {
      await theses.confirmEntity(sessionId, entityId, ticker);
    },
    startInvestigation: (sessionId) => investigation.start(sessionId),
    async scoreboard(sessionId) {
      const session = await prisma.thesisSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { status: true, claims: { orderBy: { ordinal: 'asc' }, select: { normalizedText: true, assessment: true, ticker: true } } },
      });
      return {
        status: session.status,
        tickers: [...new Set(session.claims.flatMap((c) => (c.ticker ? [c.ticker] : [])))],
        claims: session.claims.map((c) => ({ text: c.normalizedText, assessment: c.assessment })),
      };
    },
    async unfinishedTelegram() {
      const rows = await prisma.thesisSession.findMany({
        where: { source: 'telegram', telegramChatId: { not: null }, status: { notIn: ['COMPLETED', 'PARTIAL', 'FAILED'] }, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
        select: { id: true, telegramChatId: true },
      });
      return rows.map((row) => ({ id: row.id, telegramChatId: row.telegramChatId! }));
    },
  };
}
