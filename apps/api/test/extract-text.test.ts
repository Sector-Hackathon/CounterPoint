import { describe, expect, it } from 'vitest';
import { ExtractTextBody } from '../src/thesis/thesis.controller';

describe('extract-text body', () => {
  it('accepts png/jpeg/webp up to ~4 MB', () => {
    expect(ExtractTextBody.safeParse({ imageBase64: 'a'.repeat(100), mimeType: 'image/png' }).success).toBe(true);
  });

  it('rejects other types and oversized payloads', () => {
    expect(ExtractTextBody.safeParse({ imageBase64: 'a', mimeType: 'application/pdf' }).success).toBe(false);
    expect(ExtractTextBody.safeParse({ imageBase64: 'a'.repeat(5_600_001), mimeType: 'image/png' }).success).toBe(false);
  });
});
