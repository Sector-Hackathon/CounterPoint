import { describe, expect, it } from 'vitest';
import { groupByDate } from '../lib/history-groups';

const entry = (id: string, createdAt: string) => ({ id, text: id, createdAt, status: 'COMPLETED', reportId: null, tickers: [] });
const now = new Date('2026-10-07T15:00:00');

describe('groupByDate', () => {
  it('buckets checks into today, yesterday, previous 7 days and older, newest first', () => {
    const groups = groupByDate(
      [
        entry('old', '2026-09-01T10:00:00'),
        entry('today-early', '2026-10-07T01:00:00'),
        entry('week', '2026-10-03T10:00:00'),
        entry('yesterday', '2026-10-06T23:30:00'),
        entry('today-late', '2026-10-07T14:00:00'),
      ],
      now,
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['today', ['today-late', 'today-early']],
      ['yesterday', ['yesterday']],
      ['week', ['week']],
      ['older', ['old']],
    ]);
  });

  it('omits empty groups', () => {
    expect(groupByDate([entry('a', '2026-10-07T09:00:00')], now).map((g) => g.key)).toEqual(['today']);
  });

  it('returns no groups for no checks', () => {
    expect(groupByDate([], now)).toEqual([]);
  });
});
