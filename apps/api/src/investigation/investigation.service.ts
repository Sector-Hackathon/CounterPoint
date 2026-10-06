import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SectorsDataSource } from '@counterpoint/sectors';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SECTORS_SOURCE } from '../sectors/sectors.module';
import { ReportsService } from '../reports/reports.service';
import { toClaim } from '../common/mappers';
import { DeterministicPlanner, investigateClaim, type Planner } from './engine';
import { LlmPlanner } from './llm-planner';
import { EventsService } from '../events/events.service';
import { statusEvent, stepEvent } from '../events/events.mappers';

const SESSION_DEADLINE_MS = Number(process.env.SESSION_DEADLINE_MS ?? 90_000);

@Injectable()
export class InvestigationService {
  private readonly logger = new Logger(InvestigationService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly reports: ReportsService,
    @Inject(SECTORS_SOURCE) private readonly source: SectorsDataSource,
    private readonly events: EventsService,
  ) {}

  private planner(): Planner {
    return this.llm.available ? new LlmPlanner(this.llm) : new DeterministicPlanner();
  }

  /** Idempotent: a session already investigating or finished is left untouched. */
  async start(sessionId: string): Promise<boolean> {
    if (this.running.has(sessionId)) return false;
    const updated = await this.prisma.thesisSession.updateMany({
      where: { id: sessionId, status: 'CLAIMS_EXTRACTED' },
      data: { status: 'INVESTIGATING' },
    });
    if (updated.count === 0) return false;
    this.events.publish(sessionId, statusEvent('INVESTIGATING'));
    this.running.add(sessionId);
    void this.run(sessionId).finally(() => this.running.delete(sessionId));
    return true;
  }

  private async run(sessionId: string) {
    const started = Date.now();
    const deadline = started + SESSION_DEADLINE_MS;
    try {
      const claims = await this.prisma.claim.findMany({ where: { sessionId }, orderBy: { ordinal: 'asc' } });
      const planner = this.planner();
      let partial = false;

      for (const row of claims) {
        const claim = toClaim(row);
        const result = await investigateClaim(claim, {
          source: this.source,
          planner,
          newId: randomUUID,
          deadline,
          onTraceStart: async (t) => {
            await this.prisma.executionTrace.create({ data: {
              ...t, startedAt: new Date(t.startedAt), finishedAt: null, planner: planner.name,
            } });
            this.events.publish(sessionId, stepEvent(t, [], claim.contractId));
          },
          onTrace: async (t, items) => {
            // Evidence is persisted per step so a replay mid-run shows the same values as the live stream.
            if (items.length) await this.prisma.evidenceItem.createMany({ data: items.map((e) => ({ ...e })) });
            const data = {
                id: t.id,
                claimId: t.claimId,
                sequence: t.sequence,
                action: t.action,
                reason: t.reason,
                startedAt: new Date(t.startedAt),
                finishedAt: t.finishedAt ? new Date(t.finishedAt) : null,
                evidenceIds: t.evidenceIds,
                resultStatus: t.resultStatus,
                stopReason: t.stopReason,
                planner: planner.name,
                checkId: t.checkId,
                expectation: t.expectation,
                expectationHeld: t.expectationHeld,
                outcome: t.outcome,
              };
            if (t.action.startsWith('get_')) {
              await this.prisma.executionTrace.update({ where: { id: t.id }, data });
            } else {
              await this.prisma.executionTrace.create({ data });
            }
            this.events.publish(sessionId, stepEvent(t, items, claim.contractId));
          },
        });

        await this.prisma.claim.update({
          where: { id: claim.id },
          data: {
            assessment: result.assessment,
            stopReason: result.stopReason,
            checkStates: { states: result.states, coverage: result.coverage } as object,
            peerSet: (result.peerSet as object | null) ?? undefined,
          },
        });
        this.events.publish(sessionId, {
          id: `assessed:${claim.id}`,
          type: 'claim.assessed',
          claimId: claim.id,
          assessment: result.assessment,
          stopReason: result.stopReason,
          coverage: result.coverage,
        });
        if (['BUDGET_EXHAUSTED', 'ERROR', 'TIMEOUT'].includes(result.stopReason)) partial = true;
        this.logger.log(
          JSON.stringify({ event: 'claim_investigated', sessionId, claimId: claim.id, stopReason: result.stopReason, assessment: result.assessment, toolCalls: result.trace.filter((t) => t.action.startsWith('get_')).length }),
        );
      }

      const report = await this.reports.build(sessionId);
      this.events.publish(sessionId, { id: `report:${report.id}`, type: 'report.ready', reportId: report.id });
      const finalStatus = partial ? 'PARTIAL' : 'COMPLETED';
      await this.prisma.thesisSession.update({ where: { id: sessionId }, data: { status: finalStatus } });
      this.events.publish(sessionId, statusEvent(finalStatus));
      this.logger.log(JSON.stringify({ event: 'session_completed', sessionId, ms: Date.now() - started }));
    } catch (err) {
      this.logger.error(`investigation failed for ${sessionId}: ${(err as Error).stack}`);
      await this.prisma.thesisSession.update({
        where: { id: sessionId },
        data: { status: 'FAILED', error: (err as Error).message },
      });
      this.events.publish(sessionId, statusEvent('FAILED', (err as Error).message));
    }
  }
}
