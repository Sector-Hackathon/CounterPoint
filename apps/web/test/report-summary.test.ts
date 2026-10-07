import { describe, expect, it } from 'vitest';
import type { ClaimReport, EvidenceItem, ReportView } from '../lib/api';
import { buildShareText, retrievalLabel, summarizeReport } from '../lib/report-summary';

function claim(assessment: ClaimReport['assessment'], overrides: Partial<ClaimReport> = {}): ClaimReport {
  return {
    claimId: assessment, assessment,
    coverage: { required: 3, completed: 3, unavailable: 0, invalid: 0, label: '3 of 3' },
    supports: [], weakens: [], context: [], missing: [], interpretation: null,
    stopReason: 'SUFFICIENT', peerSet: null, counterpoint: null, changeConditions: [], ...overrides,
  };
}
const report = (claims: ClaimReport[]): ReportView => ({
  id: 'report', claims, disclaimer: '', validationStatus: 'VALID', validationIssues: [],
});
const evidence = (retrievalTime: string, status = 'VALID') => ({ retrievalTime, status } as EvidenceItem);

describe('report summary and sharing', () => {
  it('counts every status without converting an unverifiable claim into an unsupported one', () => {
    const summary = summarizeReport(report([claim('SUPPORTED'), claim('SUPPORTED'), claim('PARTIALLY_SUPPORTED'), claim('NOT_SUPPORTED'), claim('UNVERIFIABLE')]));
    expect(summary.total).toBe(5);
    expect(summary.counts).toEqual({ SUPPORTED: 2, PARTIALLY_SUPPORTED: 1, NOT_SUPPORTED: 1, UNVERIFIABLE: 1 });
  });

  it('distinguishes incomplete investigations from out-of-scope predictions', () => {
    const outOfScope = claim('UNVERIFIABLE', { stopReason: 'OUT_OF_SCOPE', missing: ['Price predictions are out of scope'], coverage: { required: 0, completed: 0, unavailable: 0, invalid: 0, label: '' } });
    expect(summarizeReport(report([outOfScope])).partial).toBe(false);
    expect(summarizeReport(report([claim('SUPPORTED', { stopReason: 'TIMEOUT' })])).partial).toBe(true);
    expect(summarizeReport(report([claim('UNVERIFIABLE', { coverage: { required: 3, completed: 2, unavailable: 1, invalid: 0, label: '' } })])).partial).toBe(true);
  });

  it('labels synthetic results, preserves quotes and verdicts, and shares the report link', () => {
    const text = buildShareText({ report: report([claim('UNVERIFIABLE')]), quotes: { UNVERIFIABLE: 'Harga akan\nnaik ke 6000' }, evidence: [], dataMode: 'fixture', url: 'https://example.com/t/session/report' });
    expect(text).toContain('“Harga akan naik ke 6000”: Belum bisa diverifikasi.');
    expect(text).toContain('Data sintetis untuk demo, bukan data keuangan asli');
    expect(text).toContain('Laporan: https://example.com/t/session/report');
    expect(text).toContain('Tidak ada waktu pengambilan data yang tersedia');
    expect(text).not.toContain('Sebagian pemeriksaan belum lengkap');
  });

  it('keeps unknown modes and partial/repaired results explicit when shared', () => {
    const result = report([claim('PARTIALLY_SUPPORTED')]);
    result.validationStatus = 'REPAIRED';
    const text = buildShareText({ report: result, quotes: {}, evidence: [], dataMode: null, url: '/report', partial: true });
    expect(text).toContain('Mode data belum terkonfirmasi');
    expect(text).toContain('Sebagian pemeriksaan belum lengkap');
    expect(text).toContain('Sebagian pernyataan dihapus setelah validasi bukti');
  });

  it('uses evidence retrieval time in Jakarta rather than the viewer’s current date', () => {
    const date = retrievalLabel([evidence('invalid'), evidence('2026-10-06T00:00:00Z'), evidence('2026-10-06T01:00:00Z'), evidence('2026-10-07T00:00:00Z', 'UNAVAILABLE')]);
    expect(date).toContain('6 Okt 2026');
    expect(date).toContain('07.00');
    expect(date).toContain('08.00');
    expect(date).toContain('WIB');
    expect(date).not.toContain('7 Okt');
  });
});
