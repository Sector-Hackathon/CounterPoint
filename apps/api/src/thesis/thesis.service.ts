import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { locateSpan } from '@counterpoint/domain';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimsService } from '../claims/claims.service';
import { EntityService, type ResolvedEntity } from '../entity/entity.service';
import { SECTORS_MODE } from '../sectors/sectors.module';
import { toClaim, toTrace } from '../common/mappers';
import { EventsService } from '../events/events.service';
import { claimSeed, claimsEvent, statusEvent } from '../events/events.mappers';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ThesisService {
  private readonly logger = new Logger(ThesisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claims: ClaimsService,
    private readonly entities: EntityService,
    @Inject(SECTORS_MODE) private readonly dataMode: 'live' | 'fixture',
    private readonly events: EventsService,
  ) {}

  private async setStatus(sessionId: string, status: string, error: string | null = null) {
    await this.prisma.thesisSession.update({ where: { id: sessionId }, data: { status, ...(error ? { error } : {}) } });
    this.events.publish(sessionId, statusEvent(status, error));
  }

  async create(rawThesis: string, userId?: string) {
    const session = await this.prisma.thesisSession.create({
      data: { rawThesis, status: 'CREATED', dataMode: this.dataMode, userId },
    });
    void this.analyze(session.id, rawThesis);
    return session;
  }

  async history(userId: string, input: { page: number; query: string; filter: string }) {
    const where: Prisma.ThesisSessionWhereInput = { userId };
    if (input.query) where.OR = [
      { rawThesis: { contains: input.query, mode: 'insensitive' } },
      { entities: { some: { ticker: { contains: input.query, mode: 'insensitive' } } } },
    ];
    if (input.filter === 'reports') where.finalReportId = { not: null };
    if (input.filter === 'active') where.status = { notIn: ['COMPLETED', 'PARTIAL', 'FAILED'] };
    if (input.filter === 'failed') where.status = 'FAILED';
    const [rows, total] = await Promise.all([
      this.prisma.thesisSession.findMany({ where, skip: (input.page - 1) * 12, take: 12, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, rawThesis: true, createdAt: true, status: true, finalReportId: true, entities: { select: { ticker: true } } } }),
      this.prisma.thesisSession.count({ where }),
    ]);
    return { total, page: input.page, pageSize: 12, items: rows.map((row) => ({ id: row.id, text: row.rawThesis, createdAt: row.createdAt.toISOString(), status: row.status, reportId: row.finalReportId, tickers: [...new Set(row.entities.flatMap((entity) => entity.ticker ? [entity.ticker] : []))] })) };
  }

  async status(id: string) {
    const session = await this.prisma.thesisSession.findUnique({ where: { id }, select: {
      status: true, error: true, finalReportId: true, updatedAt: true,
      claims: { orderBy: { ordinal: 'asc' }, select: { id: true, assessment: true, _count: { select: { trace: true } }, trace: { orderBy: { sequence: 'desc' }, take: 1, select: { id: true, resultStatus: true, finishedAt: true } } } },
    } });
    if (!session) throw new NotFoundException('session not found');
    return { status: session.status, error: session.error, finalReportId: session.finalReportId, revision: JSON.stringify([session.updatedAt, session.claims]) };
  }

  /** Entity resolution + claim decomposition. Pauses for confirmation instead of guessing. */
  private async analyze(sessionId: string, thesis: string) {
    try {
      const { extraction, extractor } = await this.claims.extract(thesis);
      const resolved = await this.entities.resolveAll(thesis, extraction.entities.map((e) => e.mention));
      const primary = resolved.find((r) => r.ticker);

      await this.prisma.entity.createMany({
        data: resolved.map((r) => ({
          sessionId,
          mention: r.mention,
          ticker: r.ticker,
          canonicalName: r.canonicalName,
          resolutionStatus: r.resolutionStatus,
          candidates: r.candidates,
          isPrimary: r === primary,
        })),
      });

      const tickerFor = (mention: string | null): string | null => {
        const match = mention && resolved.find((r) => r.mention.toUpperCase() === mention.toUpperCase());
        if (match) return match.ticker;
        return primary?.ticker ?? null;
      };

      await this.prisma.claim.createMany({
        data: extraction.claims.map((c, i) => {
          const scope = this.claims.toContract(c.claim_type, c.verifiability, c.scope_note);
          const span = locateSpan(thesis, c.original_text);
          return {
            sessionId,
            ordinal: i,
            originalText: c.original_text,
            normalizedText: c.normalized_text,
            ticker: tickerFor(c.entity_mention),
            entityMention: c.entity_mention,
            claimType: c.claim_type,
            comparisonType: c.comparison_type,
            timeScope: c.time_scope,
            direction: c.direction,
            extractor,
            spanStart: span?.start ?? null,
            spanEnd: span?.end ?? null,
            ...scope,
          };
        }),
      });

      const rows = await this.prisma.claim.findMany({ where: { sessionId }, orderBy: { ordinal: 'asc' } });
      this.events.publish(sessionId, claimsEvent(thesis, rows.map((row) => claimSeed(toClaim(row), row.ordinal))));

      const needsConfirmation = resolved.some((r) => r.resolutionStatus === 'AMBIGUOUS') || !primary;
      await this.setStatus(sessionId, needsConfirmation ? 'AWAITING_CONFIRMATION' : 'CLAIMS_EXTRACTED');
    } catch (err) {
      this.logger.error(`analysis failed for ${sessionId}: ${(err as Error).message}`);
      await this.setStatus(sessionId, 'FAILED', (err as Error).message);
    }
  }

  async confirmEntity(sessionId: string, entityId: string, ticker: string) {
    const entity = await this.prisma.entity.findFirst({ where: { id: entityId, sessionId } });
    if (!entity) throw new NotFoundException('entity not found');
    const candidates = entity.candidates as unknown as ResolvedEntity['candidates'];
    const choice = candidates.find((c) => c.ticker === ticker.toUpperCase());
    const resolved = choice ?? (await this.entities.resolve(ticker)).candidates.find((c) => c.ticker === ticker.toUpperCase());
    if (!resolved) throw new BadRequestException('ticker is not a known company');

    const hasPrimary = await this.prisma.entity.count({ where: { sessionId, isPrimary: true } });
    await this.prisma.entity.update({
      where: { id: entityId },
      data: { ticker: resolved.ticker, canonicalName: resolved.name, resolutionStatus: 'CONFIRMED', isPrimary: hasPrimary === 0 },
    });
    await this.prisma.claim.updateMany({
      where: { sessionId, OR: [{ entityMention: entity.mention }, { ticker: null }] },
      data: { ticker: resolved.ticker },
    });
    const stillAmbiguous = await this.prisma.entity.count({ where: { sessionId, resolutionStatus: 'AMBIGUOUS' } });
    if (stillAmbiguous === 0) {
      await this.setStatus(sessionId, 'CLAIMS_EXTRACTED');
    }
    return this.get(sessionId);
  }

  async get(sessionId: string) {
    const session = await this.prisma.thesisSession.findUnique({
      where: { id: sessionId },
      include: {
        entities: true,
        claims: { orderBy: { ordinal: 'asc' }, include: { trace: { orderBy: { sequence: 'asc' } } } },
      },
    });
    if (!session) throw new NotFoundException('thesis session not found');
    return {
      ...session,
      claims: session.claims.map(({ trace, checkStates: _states, ...c }) => ({ ...c, trace: trace.map(toTrace) })),
    };
  }

  async trace(sessionId: string) {
    const claims = await this.prisma.claim.findMany({
      where: { sessionId },
      orderBy: { ordinal: 'asc' },
      include: { trace: { orderBy: { sequence: 'asc' } } },
    });
    return claims.map((c) => ({ claimId: c.id, normalizedText: c.normalizedText, stopReason: c.stopReason, events: c.trace.map(toTrace) }));
  }
}
