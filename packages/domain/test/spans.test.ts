import { describe, expect, it } from 'vitest';
import { locateSpan } from '../src';

const thesis = 'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain.';

describe('locateSpan', () => {
  it('finds an exact quote', () => {
    const at = thesis.indexOf('growth kuat');
    expect(locateSpan(thesis, 'growth kuat')).toEqual({ start: at, end: at + 'growth kuat'.length });
  });

  it('ignores case and collapses whitespace', () => {
    const s = locateSpan(thesis, 'Valuasinya   murah');
    expect(thesis.slice(s!.start, s!.end)).toBe('valuasinya murah');
  });

  it('strips surrounding quotes and trailing punctuation from the fragment', () => {
    const s = locateSpan(thesis, '“bank besar lain.”');
    expect(thesis.slice(s!.start, s!.end)).toBe('bank besar lain');
  });

  it('returns null for a paraphrase', () => {
    expect(locateSpan(thesis, 'strong growth')).toBeNull();
  });

  it('returns null for an empty fragment', () => {
    expect(locateSpan(thesis, '  ')).toBeNull();
  });
});
