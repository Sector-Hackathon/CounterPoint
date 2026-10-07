import type { Assessment, ClaimReport, EvidenceItem, ReportView } from './api';
import { translate, type Language } from './locale';

export const ASSESSMENT_TEXT: Record<Assessment | 'PENDING', string> = {
  SUPPORTED: 'Didukung data',
  PARTIALLY_SUPPORTED: 'Didukung sebagian',
  NOT_SUPPORTED: 'Tidak didukung data',
  UNVERIFIABLE: 'Belum bisa diverifikasi',
  PENDING: 'Sedang diperiksa',
};

export const assessmentText = (status: Assessment | 'PENDING', language: Language = 'id') => translate(language, ASSESSMENT_TEXT[status]);

export function summarizeReport(report: ReportView) {
  const counts: Record<Assessment, number> = {
    SUPPORTED: 0, PARTIALLY_SUPPORTED: 0, NOT_SUPPORTED: 0, UNVERIFIABLE: 0,
  };
  for (const claim of report.claims) counts[claim.assessment]++;
  return {
    counts,
    total: report.claims.length,
    partial: report.claims.some((c) => ['BUDGET_EXHAUSTED', 'TIMEOUT', 'ERROR'].includes(c.stopReason ?? '') || c.coverage.completed < c.coverage.required),
  };
}

export function retrievalLabel(evidence: EvidenceItem[], language: Language = 'id'): string {
  const dates = evidence.filter((e) => e.status === 'VALID').map((e) => Date.parse(e.retrievalTime)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!dates.length) return translate(language, 'Tidak ada waktu pengambilan data yang tersedia');
  const format = (date: number) => new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(date);
  const first = format(dates[0]!);
  const last = format(dates[dates.length - 1]!);
  return `${first === last ? first : `${first} – ${last}`} WIB`;
}

export function dataModeLabel(mode: 'live' | 'fixture' | null, language: Language = 'id'): string {
  return translate(language, mode === 'live' ? 'Sectors API' : mode === 'fixture' ? 'Data sintetis untuk demo, bukan data keuangan asli' : 'Mode data belum terkonfirmasi');
}

export function buildShareText(input: {
  report: ReportView;
  quotes: Record<string, string>;
  evidence: EvidenceItem[];
  dataMode: 'live' | 'fixture' | null;
  url: string;
  partial?: boolean;
  language?: Language;
}): string {
  const { report, quotes, evidence, dataMode, url } = input;
  const language = input.language ?? 'id';
  const t = (message: string, values?: Record<string, string | number>) => translate(language, message, values);
  const { counts, total, partial } = summarizeReport(report);
  const claimLines = report.claims.map((c: ClaimReport, i) => {
    const quote = (quotes[c.claimId] ?? `${t('Klaim')} ${i + 1}`).replace(/\s+/g, ' ').trim();
    return `• “${quote}”: ${assessmentText(c.assessment, language)}.`;
  });
  return [
    t('Counterpoint — hasil pemeriksaan klaim saham'),
    t('{total} klaim dinilai: {supported} didukung data, {partial} didukung sebagian, {unsupported} tidak didukung data, {unverifiable} belum bisa diverifikasi.', { total, supported: counts.SUPPORTED, partial: counts.PARTIALLY_SUPPORTED, unsupported: counts.NOT_SUPPORTED, unverifiable: counts.UNVERIFIABLE }),
    '', ...claimLines, '',
    ...(partial || input.partial ? [t('Sebagian pemeriksaan belum lengkap. Baca keterbatasan di laporan.')] : []),
    ...(report.validationStatus === 'REPAIRED' ? [t('Sebagian pernyataan dihapus setelah validasi bukti.')] : []),
    ...(report.validationStatus === 'FAILED' ? [t('Validasi laporan gagal; hasil belum dapat diandalkan.')] : []),
    `${t('Sumber')}: ${dataModeLabel(dataMode, language)}.`,
    `${t('Data diambil')}: ${retrievalLabel(evidence, language)}.`,
    t('Periode tiap metrik dan bukti pendukung tersedia di laporan.'),
    `${t('Laporan')}: ${url}`,
    t('Tautan laporan hanya dapat dibuka oleh akun pemiliknya.'),
    t('Informasi dan analisis saja, bukan rekomendasi beli, jual, atau tahan saham.'),
  ].join('\n');
}
