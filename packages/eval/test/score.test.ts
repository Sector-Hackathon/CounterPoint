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

describe('counterpoint scoring', () => {
  const cp: ClaimCase = { ...c, expected: { assessment: 'SUPPORTED', stopReason: 'SUFFICIENT', counterpoint: { roe_vs_peers: 'confirmed' } } };
  const base = { assessment: 'SUPPORTED' as const, stopReason: 'SUFFICIENT' as const, replanned: false, toolCalls: 4, toolPath: [], uncitedNumbers: 0 };

  it('fails when a hypothesis outcome differs', () => {
    const s = scoreClaimCase(cp, { ...base, counterpoint: { roe_vs_peers: 'refuted' } });
    expect(s.pass).toBe(false);
    expect(s.failures.join(' ')).toContain('roe_vs_peers');
  });

  it('treats a missing hypothesis as not_tested', () => {
    const s = scoreClaimCase(cp, base);
    expect(s.failures).toEqual(['counterpoint roe_vs_peers: expected confirmed, got not_tested']);
  });

  it('passes when outcomes match', () => {
    expect(scoreClaimCase(cp, { ...base, counterpoint: { roe_vs_peers: 'confirmed' } }).pass).toBe(true);
  });
});
