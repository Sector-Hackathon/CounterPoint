import { describe, expect, it } from 'vitest';
import type { EvidenceItem } from '../src/models';
import { extractNumbers, guardLanguage, validateStatement } from '../src/validation';

const item = (id: string, value: number): EvidenceItem => ({
  id,
  claimId: 'c1',
  checkId: 'revenue_growth',
  metric: 'revenue_yoy_pct',
  ticker: 'BBRI',
  value,
  unit: 'percent',
  economicPeriod: '2025Q2',
  comparisonPeriod: '2024Q2',
  observationDate: null,
  retrievalTime: '2026-09-26T00:00:00Z',
  sourceLocator: 'sectors:test',
  derivedFrom: [],
  calculationVersion: 'calc-v1',
  status: 'VALID',
  note: null,
});

describe('validation', () => {
  const evidence = new Map([
    ['ev-1', item('ev-1', 12.3456)],
    ['ev-2', item('ev-2', 45_200_000_000_000)],
  ]);

  it('ignores period tokens when extracting numbers', () => {
    expect(extractNumbers('Revenue grew 12.3% in 2025Q2 vs Q2 2024 (FY2024)').map((n) => n.value)).toEqual([
      12.3,
    ]);
  });

  it('ignores ISO dates when extracting numbers', () => {
    expect(extractNumbers('P/E vs peer median -24.0% (as of 2026-09-24)').map((n) => n.value)).toEqual([-24]);
  });

  it('accepts numbers that match cited evidence at display precision', () => {
    expect(validateStatement({ text: 'Revenue grew 12.3% YoY.', evidenceIds: ['ev-1'] }, evidence)).toEqual([]);
    expect(
      validateStatement({ text: 'Revenue was IDR 45.2 trillion.', evidenceIds: ['ev-2'] }, evidence),
    ).toEqual([]);
  });

  it('rejects uncited numbers and unknown evidence ids', () => {
    const issues = validateStatement({ text: 'Revenue grew 15% YoY.', evidenceIds: ['ev-1', 'ev-9'] }, evidence);
    expect(issues.map((i) => i.kind).sort()).toEqual(['uncited_number', 'unknown_evidence']);
  });

  describe('numeric sign (phase 1B)', () => {
    const negative = new Map([
      ['neg-1', item('neg-1', -12.3456)],
      ['neg-2', item('neg-2', -45_200_000_000_000)],
    ]);
    const kinds = (text: string, ids: string[], ev = negative) =>
      validateStatement({ text, evidenceIds: ids }, ev).map((i) => i.kind);

    it('rejects a growth sentence written against a decline', () => {
      expect(kinds('Revenue grew 12.3% YoY.', ['neg-1'])).toContain('uncited_number');
      expect(kinds('Revenue is up 12.3% YoY.', ['neg-1'])).toContain('uncited_number');
      expect(kinds('Revenue was IDR 45.2 trillion.', ['neg-2'])).toContain('uncited_number');
    });

    it('accepts an unsigned figure when the sentence states a decline', () => {
      expect(kinds('Revenue fell 12.3% YoY.', ['neg-1'])).toEqual([]);
      expect(kinds('Net income growth declined by 12.3%.', ['neg-1'])).toEqual([]);
      expect(kinds('P/E is 12.3% below the peer median.', ['neg-1'])).toEqual([]);
      expect(kinds('Pendapatan turun 12.3% YoY.', ['neg-1'])).toEqual([]);
    });

    it('accepts an explicitly signed figure either way', () => {
      expect(kinds('Revenue growth was -12.3% YoY.', ['neg-1'])).toEqual([]);
      // The UI renders negatives with a typographic minus (U+2212).
      expect(kinds('Revenue growth was −12.3% YoY.', ['neg-1'])).toEqual([]);
      expect(validateStatement({ text: 'Revenue grew 12.3% YoY.', evidenceIds: ['ev-1'] }, evidence)).toEqual([]);
    });

    it('rejects a negative figure written against a positive value', () => {
      expect(validateStatement({ text: 'Revenue growth was -12.3% YoY.', evidenceIds: ['ev-1'] }, evidence).map((i) => i.kind)).toContain('uncited_number');
    });

    it('keeps a mixed sentence valid when each figure matches its own evidence', () => {
      const mixed = new Map([
        ['up', item('up', 8.4)],
        ['down', item('down', -5.8)],
      ]);
      expect(kinds('Revenue grew 8.4% while net income fell 5.8%.', ['up', 'down'], mixed)).toEqual([]);
    });
  });

  it('flags advice and causal language', () => {
    expect(guardLanguage('This is a strong buy.').map((i) => i.kind)).toContain('advice');
    expect(guardLanguage('Saham ini layak beli.').map((i) => i.kind)).toContain('advice');
    expect(guardLanguage('Margins fell due to higher provisions.').map((i) => i.kind)).toContain('causality');
    expect(guardLanguage('Sell-side estimates are not used.')).toEqual([]);
  });

  describe('investment framing and forward-looking language (phase 4)', () => {
    const flagged = (text: string) => guardLanguage(text).some((i) => i.kind === 'advice');

    it('rejects framing evidence as an investment case', () => {
      for (const text of [
        'The yield looks attractive for income investors.',
        'This presents an opportunity at current levels.',
        'The stock should outperform its peers.',
        'Investors may consider accumulating on weakness.',
        'The shares look like a bargain.',
        'A re-rating is plausible from here.',
      ]) {
        expect(flagged(text), text).toBe(true);
      }
    });

    it('rejects predicting direction', () => {
      for (const text of [
        'The price will rise once earnings recover.',
        'Revenue will continue to grow next year.',
        'Earnings are expected to rise.',
        'There is meaningful upside potential.',
      ]) {
        expect(flagged(text), text).toBe(true);
      }
    });

    it('rejects the Indonesian equivalents', () => {
      for (const text of [
        'Sahamnya masih menarik di harga sekarang.',
        'Ini peluang bagus untuk masuk.',
        'Harganya akan naik setelah laporan keuangan.',
        'Potensi cuan masih besar.',
        'Layak dikoleksi untuk jangka panjang.',
      ]) {
        expect(flagged(text), text).toBe(true);
      }
    });

    it('leaves neutral evidence wording alone', () => {
      for (const text of [
        'Trailing dividend yield 9.7% (TTM).',
        'Net income growth YoY -5.8% (FY2025 vs FY2024).',
        'Target P/E versus frozen peer median: P/E vs peer median -47.7%.',
        'Latest fiscal year ROE versus its average over the prior three years.',
        'Only 2 peers report FY2025 ROE; need 4.',
        'Is the P/E actually below the peer median?',
        'A positive P/E is required; zero or negative is not comparable.',
      ]) {
        expect(guardLanguage(text), text).toEqual([]);
      }
    });
  });
});
