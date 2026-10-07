import { describe, expect, it } from 'vitest';
import { coverageLabel, stopReasonLabel } from '../lib/display-copy';
import { translate } from '../lib/locale';
import { permanentSessionError } from '../lib/session-logic';
describe('review display fixes', () => {
  it('explains zero-contract coverage in both languages', () => { const coverage = { required: 0, completed: 0, unavailable: 0, invalid: 0, label: 'No evidence contract applies' }; expect(coverageLabel(coverage, 'id')).not.toContain('0 dari 0'); expect(coverageLabel(coverage, 'en')).toBe('No evidence checks apply to this claim.'); });
  it.each(['SUFFICIENT', 'UNOBTAINABLE', 'DUPLICATE', 'OUT_OF_SCOPE', 'BUDGET_EXHAUSTED', 'TIMEOUT', 'ERROR'])('renders %s as prose in both languages', (reason) => { expect(stopReasonLabel(reason, 'id')).not.toBe(reason); expect(stopReasonLabel(reason, 'en')).not.toBe(reason); expect(stopReasonLabel(reason, 'en')).not.toBe(stopReasonLabel(reason, 'id')); });
  it('handles singular and plural English counts', () => { expect(translate('en', '{count} langkah', { count: 1 })).toBe('1 step'); expect(translate('en', '{count} langkah', { count: 2 })).toBe('2 steps'); expect(translate('en', '{count} perusahaan', { count: 1 })).toBe('1 company'); expect(translate('en', 'Membuka {count} pertanyaan lanjutan', { count: 1 })).toBe('Opens 1 follow-up question'); });
  it('stops polling on permanent errors but retries temporary failures', () => { for (const status of [400, 401, 403, 404, 410]) expect(permanentSessionError(status)).toBe(true); for (const status of [429, 500, 502, 503]) expect(permanentSessionError(status)).toBe(false); });
});
