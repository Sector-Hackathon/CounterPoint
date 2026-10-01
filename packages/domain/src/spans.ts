import type { Span } from './models';

const TRIM = /^[\s"'“”‘’]+|[\s"'“”‘’.,;:!?]+$/g;

/**
 * Locates a claim's quote inside the raw thesis so the UI can highlight it. Exact match first,
 * then case-insensitive with collapsed whitespace. Returns null rather than guessing.
 */
export function locateSpan(text: string, fragment: string): Span | null {
  const needle = fragment.replace(TRIM, '');
  if (!needle.trim()) return null;

  const exact = text.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length };

  const pattern = needle
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const m = new RegExp(pattern, 'i').exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
