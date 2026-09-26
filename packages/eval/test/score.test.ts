import { describe, expect, it } from 'vitest';
import { scoreClaimCase, summarize, type ClaimCase } from '../src';

const c: ClaimCase = {
  id: 'x',
  split: 'dev',
  description: '',
  claim: { ticker: 'BBRI', claimType: 'ABSOLUTE_GROWTH', verifiability: 'YES', normalizedText: '' },
  expected: { assessment: 'SUPPORTED', stopReason: 'SUFFICIENT', replan: false },
};

describe('scoring', () => {
  it('passes matching results', () => {
    const s = scoreClaimCase(c, { assessment: 'SUPPORTED', stopReason: 'SUFFICIENT', replanned: false, toolCalls: 4, toolPath: [], uncitedNumbers: 0 });
    expect(s.pass).toBe(true);
  });

  it('reports every mismatch', () => {
    const s = scoreClaimCase(c, { assessment: 'NOT_SUPPORTED', stopReason: 'SUFFICIENT', replanned: true, toolCalls: 4, toolPath: [], uncitedNumbers: 1 });
    expect(s.failures).toHaveLength(3);
    expect(summarize([s])).toContain('dev: 0/1 passed');
  });
});
