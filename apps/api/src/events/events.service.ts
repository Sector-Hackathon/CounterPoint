import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { Assessment, Coverage } from '@counterpoint/domain';
import { PrismaService } from '../prisma/prisma.service';
import { toClaim, toEvidence, toTrace } from '../common/mappers';
import { claimSeed, claimsEvent, statusEvent, stepEvent } from './events.mappers';
import type { SessionEvent } from './events.types';

/**
 * In-process session event bus (final-week spec F3). Live events are published by the
 * thesis and investigation services; a new subscriber first receives a replay built from
 * Postgres, then live events. Ids make the merge idempotent.
 */
@Injectable()
export class EventsService {
  private readonly subjects = new Map<string, Subject<SessionEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  private subject(sessionId: string): Subject<SessionEvent> {
    let s = this.subjects.get(sessionId);
    if (!s) {
      s = new Subject<SessionEvent>();
      this.subjects.set(sessionId, s);
    }
    return s;
  }

  /** Number of sessions with at least one live subscriber. */
  activeSessions(): number {
    return this.subjects.size;
  }

  publish(sessionId: string, event: SessionEvent): void {
    this.subjects.get(sessionId)?.next(event);
  }

  stream(sessionId: string): Observable<{ id: string; data: SessionEvent }> {
    return new Observable((sub) => {
      const seen = new Set<string>();
      const buffer: SessionEvent[] = [];
      let replaying = true;
      const emit = (e: SessionEvent) => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        sub.next({ id: e.id, data: e });
      };
      const subject = this.subject(sessionId);
      const live = subject.subscribe((e) => (replaying ? buffer.push(e) : emit(e)));
      this.replay(sessionId)
        .then((events) => {
          events.forEach(emit);
          replaying = false;
          buffer.splice(0).forEach(emit);
        })
        .catch((err) => sub.error(err));
      return () => {
        live.unsubscribe();
        if (!subject.observed) this.subjects.delete(sessionId);
      };
    });
  }

  /** Rebuilds the full event list for a session from stored rows, in causal order; status comes last. */
  async replay(sessionId: string): Promise<SessionEvent[]> {
    const session = await this.prisma.thesisSession.findUnique({
      where: { id: sessionId },
      include: {
        claims: { orderBy: { ordinal: 'asc' }, include: { trace: { orderBy: { sequence: 'asc' } }, evidence: true } },
      },
    });
    if (!session) return [];
    const out: SessionEvent[] = [];
    if (session.claims.length) {
      out.push(claimsEvent(session.rawThesis, session.claims.map((row) => claimSeed(toClaim(row), row.ordinal))));
    }
    for (const row of session.claims) {
      const evidence = new Map(row.evidence.map((e) => [e.id, toEvidence(e)]));
      for (const t of row.trace.map(toTrace)) {
        const items = t.action.startsWith('get_') ? t.evidenceIds.flatMap((id) => evidence.get(id) ?? []) : [];
        out.push(stepEvent(t, items, row.contractId));
      }
      if (row.assessment && row.stopReason) {
        const stored = row.checkStates as { coverage?: Coverage | null } | null;
        out.push({
          id: `assessed:${row.id}`,
          type: 'claim.assessed',
          claimId: row.id,
          assessment: row.assessment as Assessment,
          stopReason: row.stopReason,
          coverage: stored?.coverage ?? null,
        });
      }
    }
    if (session.finalReportId) {
      out.push({ id: `report:${session.finalReportId}`, type: 'report.ready', reportId: session.finalReportId });
    }
    out.push(statusEvent(session.status, session.error));
    return out;
  }
}
