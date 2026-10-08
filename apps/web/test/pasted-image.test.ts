import { describe, expect, it } from 'vitest';
import { pastedImage } from '../lib/pasted-image';

const file = (type: string) => ({ type, name: `clip.${type.split('/')[1]}` });

describe('pastedImage', () => {
  it('takes a pasted screenshot', () => {
    const png = file('image/png');
    expect(pastedImage({ files: [png], types: ['Files'] })).toBe(png);
  });

  it('passes an unsupported image through so the reader can explain why', () => {
    const gif = file('image/gif');
    expect(pastedImage({ files: [gif], types: ['Files'] })).toBe(gif);
  });

  it('leaves plain text paste alone', () => {
    expect(pastedImage({ files: [], types: ['text/plain'] })).toBeNull();
  });

  it('keeps the text when a copy carries both text and a picture of it, as spreadsheets do', () => {
    expect(pastedImage({ files: [file('image/png')], types: ['text/plain', 'text/html', 'Files'] })).toBeNull();
  });

  it('ignores pasted files that are not images', () => {
    expect(pastedImage({ files: [file('application/pdf')], types: ['Files'] })).toBeNull();
  });
});
