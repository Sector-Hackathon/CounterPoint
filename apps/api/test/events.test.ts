import { describe, expect, it } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { EventsService } from '../src/events/events.service';
import { statusEvent } from '../src/events/events.mappers';
import type { SessionEvent } from '../src/events/events.types';

function serviceWithReplay(replay: () => Promise<SessionEvent[]>) {
  const s = new EventsService(null as never);
  s.replay = replay;
  return s;
}

const report = (id: string): SessionEvent => ({ id, type: 'report.ready', reportId: 'x' });

describe('EventsService.stream', () => {
  it('returns 404 rather than an empty replay for a nonexistent session', async () => {
    const s = new EventsService({ thesisSession: { findUnique: async () => null } } as never);
    await expect(s.replay('missing')).rejects.toMatchObject({ status: 404 });
  });
  it('replays stored events, then live ones, without duplicates', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const s = serviceWithReplay(async () => {
      await gate;
      return [statusEvent('INVESTIGATING'), report('trace:1')];
    });
    const received = firstValueFrom(s.stream('s1').pipe(take(3), toArray()));
    // Arrives while replay is still loading: must be buffered, and the duplicate dropped.
    s.publish('s1', report('trace:1'));
    s.publish('s1', statusEvent('COMPLETED'));
    release();
    expect((await received).map((m) => m.id)).toEqual(['status:INVESTIGATING', 'trace:1', 'status:COMPLETED']);
  });

  it('does not leak events across sessions', async () => {
    const s = serviceWithReplay(async () => []);
    const received = firstValueFrom(s.stream('a').pipe(take(1), toArray()));
    await new Promise((r) => setTimeout(r, 0));
    s.publish('b', statusEvent('COMPLETED'));
    s.publish('a', statusEvent('FAILED'));
    expect((await received)[0]!.id).toBe('status:FAILED');
  });

  it('forgets a session subject once its last subscriber leaves', async () => {
    const s = serviceWithReplay(async () => []);
    const sub = s.stream('a').subscribe();
    await new Promise((r) => setTimeout(r, 0));
    sub.unsubscribe();
    expect(s.activeSessions()).toBe(0);
  });
});
