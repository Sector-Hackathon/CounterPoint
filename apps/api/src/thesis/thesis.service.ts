import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimsService } from '../claims/claims.service';
import { EntityService, type ResolvedEntity } from '../entity/entity.service';
import { SECTORS_MODE } from '../sectors/sectors.module';
import { toTrace } from '../common/mappers';

@Injectable()
export class ThesisService {
  private readonly logger = new Logger(ThesisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claims: ClaimsService,
    private readonly entities: EntityService,
    @Inject(SECTORS_MODE) private readonly dataMode: 'live' | 'fixture',
  ) {}

  async create(rawThesis: string) {
    const session = await this.prisma.thesisSession.create({
      data: { rawThesis, status: 'CREATED', dataMode: this.dataMode },
    });
    void this.analyze(session.id, rawThesis);
    return session;
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
            extractor,
            ...scope,
          };
        }),
      });

      const needsConfirmation = resolved.some((r) => r.resolutionStatus === 'AMBIGUOUS') || !primary;
      await this.prisma.thesisSession.update({
        where: { id: sessionId },
        data: { status: needsConfirmation ? 'AWAITING_CONFIRMATION' : 'CLAIMS_EXTRACTED' },
      });
    } catch (err) {
      this.logger.error(`analysis failed for ${sessionId}: ${(err as Error).message}`);
      await this.prisma.thesisSession.update({ where: { id: sessionId }, data: { status: 'FAILED', error: (err as Error).message } });
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
      await this.prisma.thesisSession.update({ where: { id: sessionId }, data: { status: 'CLAIMS_EXTRACTED' } });
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
