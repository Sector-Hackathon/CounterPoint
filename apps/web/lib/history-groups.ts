import type { HistoryEntry } from './api';

export type HistoryGroupKey = 'today' | 'yesterday' | 'week' | 'older';
export interface HistoryGroup { key: HistoryGroupKey; items: HistoryEntry[] }

const ORDER: HistoryGroupKey[] = ['today', 'yesterday', 'week', 'older'];
export const GROUP_LABEL: Record<HistoryGroupKey, string> = {
  today: 'Hari ini',
  yesterday: 'Kemarin',
  week: '7 hari terakhir',
  older: 'Lebih lama',
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Sidebar grouping by the viewer's local calendar day, newest first; empty groups are dropped. */
export function groupByDate(entries: HistoryEntry[], now: Date = new Date()): HistoryGroup[] {
  const today = startOfDay(now);
  const keyOf = (createdAt: string): HistoryGroupKey => {
    const day = startOfDay(new Date(createdAt));
    if (day >= today) return 'today';
    if (day >= today - DAY) return 'yesterday';
    if (day >= today - 7 * DAY) return 'week';
    return 'older';
  };
  const sorted = [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return ORDER.map((key) => ({ key, items: sorted.filter((e) => keyOf(e.createdAt) === key) })).filter((g) => g.items.length > 0);
}
