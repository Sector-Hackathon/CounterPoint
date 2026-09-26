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

  it('flags advice and causal language', () => {
    expect(guardLanguage('This is a strong buy.').map((i) => i.kind)).toContain('advice');
    expect(guardLanguage('Saham ini layak beli.').map((i) => i.kind)).toContain('advice');
    expect(guardLanguage('Margins fell due to higher provisions.').map((i) => i.kind)).toContain('causality');
    expect(guardLanguage('Sell-side estimates are not used.')).toEqual([]);
  });
});
