import { describe, expect, it } from 'vitest';
import { conditionText, formatValue, stepHeadline } from '../lib/format';

describe('format', () => {
  it('formats units', () => {
    expect(formatValue(8.437, 'percent')).toBe('8.4%');
    expect(formatValue(-3.1, 'percentage_points')).toBe('−3.1 pp');
    expect(formatValue(7.58, 'ratio')).toBe('7.58×');
    expect(formatValue(null, 'percent')).toBe('n/a');
  });

  it('names tool steps in plain words', () => {
    expect(stepHeadline({ action: 'get_quarterly_financials' } as never)).toBe('Membaca laporan kuartalan');
    expect(stepHeadline({ action: 'REPLAN' } as never)).toBe('Mengubah langkah pemeriksaan');
  });
});

describe('conditionText', () => {
  it('writes a change condition in plain words', () => {
    expect(conditionText({ checkId: 'revenue_growth', label: 'Latest-quarter revenue growth YoY', comparator: 'at_least', threshold: 10, current: 8.4, unit: 'percent', period: '2026Q2', evidenceId: 'e', effect: 'would_support', wouldBecome: null }))
      .toBe('Latest-quarter revenue growth YoY perlu minimal 10.0% agar mendukung klaim. Saat ini 8.4% (2026Q2).');
    expect(conditionText({ checkId: 'margin_deterioration', label: 'Net margin change YoY', comparator: 'above', threshold: -2, current: -3.1, unit: 'percentage_points', period: '2026Q2', evidenceId: 'e', effect: 'would_stop_weakening', wouldBecome: 'SUPPORTED' }))
      .toBe('Net margin change YoY perlu di atas −2.0 pp agar tidak lagi melemahkan klaim. Saat ini −3.1 pp (2026Q2).');
  });

  it('writes missing required evidence as something to obtain, not a number to move', () => {
    expect(
      conditionText({
        checkId: 'peer_baseline', label: 'Target P/E versus frozen peer median', comparator: null, threshold: null,
        current: null, unit: null, period: null, evidenceId: null, effect: 'missing_evidence', wouldBecome: 'PARTIALLY_SUPPORTED',
      }),
    ).toBe('Target P/E versus frozen peer median belum tersedia. Data ini diperlukan untuk melengkapi pemeriksaan.');
  });
});
