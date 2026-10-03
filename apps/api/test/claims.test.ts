import { describe, expect, it } from 'vitest';
import { ExtractionSchema } from '../src/llm/prompts';
import { heuristicExtract, safeScopeNote } from '../src/claims/claims.service';

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

describe('scope note guard (phase 4)', () => {
  it('keeps a neutral model-written note', () => {
    const note = 'Future prices are not derivable from reported financials.';
    expect(safeScopeNote(note, 'FORWARD_LOOKING')).toBe(note);
  });

  it('falls back to the canned note when the model frames it as advice', () => {
    const out = safeScopeNote('The price target of 6000 looks attractive, so this is worth accumulating.', 'FORWARD_LOOKING');
    expect(out).toBe('Forward-looking claims about prices, returns, or future outcomes are outside available evidence.');
  });

  it('drops a guarded note when its claim type has no canned wording', () => {
    expect(safeScopeNote('Masih menarik untuk dikoleksi.', 'ABSOLUTE_GROWTH')).toBeNull();
    expect(safeScopeNote(null, 'ABSOLUTE_GROWTH')).toBeNull();
  });
});
