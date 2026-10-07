import { describe, expect, it } from 'vitest';
import { parseLanguage, translate } from '../lib/locale';
import { assessmentText, buildShareText, retrievalLabel } from '../lib/report-summary';
import { conditionText, metricLabel, stepHeadline } from '../lib/format';
import type { ClaimReport, EvidenceItem, ReportView } from '../lib/api';

describe('language selection', () => {
  it('restores only supported preferences and safely defaults to Indonesian', () => {
    expect(parseLanguage('en')).toBe('en');
    expect(parseLanguage('id')).toBe('id');
    expect(parseLanguage(null)).toBe('id');
    expect(parseLanguage('unsupported')).toBe('id');
  });

  it('translates interface labels and interpolates counts without changing user text', () => {
    expect(translate('en', 'Salin hasil untuk dibagikan')).toBe('Copy results to share');
    expect(translate('id', 'Salin hasil untuk dibagikan')).toBe('Salin hasil untuk dibagikan');
    expect(translate('en', '{completed} dari {required} pemeriksaan wajib tersedia', { completed: 2, required: 3 }))
      .toBe('2 of 3 required checks available');
    expect(translate('en', 'BBRI akan naik ke 6000')).toBe('BBRI akan naik ke 6000');
  });

  it('changes status and metric labels, keeping the same check meaning', () => {
    expect(assessmentText('UNVERIFIABLE', 'en')).toBe('Cannot be verified');
    expect(assessmentText('UNVERIFIABLE', 'id')).toBe('Belum bisa diverifikasi');
    expect(metricLabel('earnings_yoy_pct', 'en')).toBe('Net income growth YoY');
    expect(metricLabel('earnings_yoy_pct', 'id')).toBe('Pertumbuhan laba bersih YoY');
    expect(stepHeadline({ action: 'REPLAN', resultStatus: 'OK' }, 'en')).toBe('Changed course');
    expect(conditionText({ checkId: 'growth', label: 'Revenue growth', comparator: 'at_least', threshold: 10, current: 8.4, unit: 'percent', period: '2026Q2', evidenceId: 'e', effect: 'would_support', wouldBecome: null }, 'en'))
      .toBe('Revenue growth would need to be at least 10.0% to count as support. It is 8.4% (2026Q2).');
  });
});

describe('bilingual sharing', () => {
  const claim: ClaimReport = {
    claimId: 'claim', assessment: 'PARTIALLY_SUPPORTED',
    coverage: { required: 3, completed: 2, unavailable: 1, invalid: 0, label: '' },
    supports: [], weakens: [], context: [], missing: ['Missing data'], interpretation: null,
    stopReason: 'TIMEOUT', peerSet: null, counterpoint: null, changeConditions: [],
  };
  const report: ReportView = { id: 'report', claims: [claim], disclaimer: '', validationStatus: 'REPAIRED', validationIssues: [] };
  const evidence = [{ status: 'VALID', retrievalTime: '2026-10-06T00:00:00Z' }] as EvidenceItem[];

  it('copies the selected language while preserving original quotes, counts, limits and links', () => {
    const input = { report, evidence, quotes: { claim: 'BBRI tumbuh kuat' }, dataMode: 'fixture' as const, url: 'https://example.com/t/session/report' };
    const english = buildShareText({ ...input, language: 'en' });
    const indonesian = buildShareText({ ...input, language: 'id' });
    expect(english).toContain('Claims assessed: 1. 0 supported, 1 partly supported, 0 not supported, 0 unverifiable.');
    expect(english).toContain('“BBRI tumbuh kuat”: Partly supported.');
    expect(indonesian).toContain('“BBRI tumbuh kuat”: Didukung sebagian.');
    expect(english).toContain('Synthetic demo data, not real company financials');
    expect(english).toContain('Some checks are incomplete');
    expect(english).toContain('Some statements were removed after evidence validation');
    expect(english).toContain('Report: https://example.com/t/session/report');
    expect(indonesian).toContain('Laporan: https://example.com/t/session/report');
    expect(report.claims[0]!.assessment).toBe('PARTIALLY_SUPPORTED');
  });

  it('formats both locales in the same declared Jakarta time zone', () => {
    expect(retrievalLabel(evidence, 'en')).toContain('6 Oct 2026');
    expect(retrievalLabel(evidence, 'en')).toContain('07:00');
    expect(retrievalLabel(evidence, 'id')).toContain('6 Okt 2026');
    expect(retrievalLabel(evidence, 'en')).toContain('WIB');
    expect(retrievalLabel([], 'en')).toBe('No data retrieval time available');
  });
});
