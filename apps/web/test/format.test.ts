import { describe, expect, it } from 'vitest';
import { formatValue, stepHeadline } from '../lib/format';

describe('format', () => {
  it('formats units', () => {
    expect(formatValue(8.437, 'percent')).toBe('8.4%');
    expect(formatValue(-3.1, 'percentage_points')).toBe('−3.1 pp');
    expect(formatValue(7.58, 'ratio')).toBe('7.58×');
    expect(formatValue(null, 'percent')).toBe('n/a');
  });

  it('names tool steps in plain words', () => {
    expect(stepHeadline({ action: 'get_quarterly_financials' } as never)).toBe('Read quarterly financials');
    expect(stepHeadline({ action: 'REPLAN' } as never)).toBe('Changed course');
  });
});
