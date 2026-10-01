import { describe, expect, it } from 'vitest';
import { ExtractionSchema } from '../src/llm/prompts';
import { heuristicExtract } from '../src/claims/claims.service';

describe('claim direction', () => {
  it('heuristic extractor marks every claim bullish', () => {
    const out = heuristicExtract('BBRI growth kuat dan valuasinya murah dibanding bank besar lain.');
    expect(out.claims.length).toBeGreaterThan(0);
    expect(out.claims.every((c) => c.direction === 'bullish')).toBe(true);
  });

  it('extraction schema requires a direction', () => {
    const claim = {
      original_text: 'growth lemah', normalized_text: 'weak growth', entity_mention: null, claim_type: 'ABSOLUTE_GROWTH',
      comparison_type: 'HISTORICAL', time_scope: null, verifiability: 'YES', scope_note: null,
    };
    expect(ExtractionSchema.safeParse({ entities: [], claims: [claim] }).success).toBe(false);
    expect(ExtractionSchema.safeParse({ entities: [], claims: [{ ...claim, direction: 'bearish' }] }).success).toBe(true);
  });
});
