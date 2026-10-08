import { describe, expect, it } from 'vitest';
import { needsShrinking, shrunkSize } from '../lib/image-upload';

describe('needsShrinking', () => {
  it('leaves small screenshots as they are', () => {
    expect(needsShrinking(800_000)).toBe(false);
  });

  it('shrinks files whose upload would come close to the proxy body limit', () => {
    expect(needsShrinking(3_000_000)).toBe(true);
  });
});

describe('shrunkSize', () => {
  it('keeps the aspect ratio and caps the long side', () => {
    expect(shrunkSize(1290, 2796)).toEqual({ width: 923, height: 2000 });
    expect(shrunkSize(4000, 1000)).toEqual({ width: 2000, height: 500 });
  });

  it('never enlarges a small image', () => {
    expect(shrunkSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });
});
