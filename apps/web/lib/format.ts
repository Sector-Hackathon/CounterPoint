import type { ChangeCondition, StepEvent } from './api';
import { translate, type Language } from './locale';

/** Formats a value for display. Minus signs use U+2212 so negative numbers read cleanly in tabular figures. */
export function formatValue(v: number | null, unit: string): string {
  if (v === null) return 'n/a';
  const sign = (s: string) => s.replace('-', '−');
  switch (unit) {
    case 'percent':
      return sign(`${v.toFixed(1)}%`);
    case 'percentage_points':
      return sign(`${v.toFixed(1)} pp`);
    case 'ratio':
      return `${v.toFixed(2)}×`;
    case 'count':
      return String(Math.round(v));
    case 'IDR':
      return `Rp ${v.toLocaleString('id-ID')}`;
    default:
      return String(v);
  }
}

const TOOLS: Record<string, string> = {
  get_company_profile: 'Membaca profil perusahaan',
  get_quarterly_financials: 'Membaca laporan kuartalan',
  get_annual_financials: 'Membaca laporan tahunan',
  get_dividend_history: 'Membaca riwayat dividen',
  get_valuation_metrics: 'Membaca valuasi',
  get_peer_candidates: 'Memilih perusahaan pembanding',
};

export function stepHeadline(s: Pick<StepEvent, 'action' | 'resultStatus'>, language: Language = 'id'): string {
  if (TOOLS[s.action]) return translate(language, TOOLS[s.action]!);
  if (s.action === 'REPLAN') return translate(language, 'Mengubah langkah pemeriksaan');
  if (s.action === 'PLAN') return translate(language, 'Memilih pemeriksaan');
  if (s.action === 'STOP') return translate(language, 'Pemeriksaan berhenti');
  // An EVALUATE step is only shown when something was rejected, so say that rather than "weighed".
  return translate(language, s.resultStatus === 'REJECTED' ? 'Menolak langkah yang tidak sesuai' : 'Menilai bukti');
}

const METRICS: Record<string, string> = {
  revenue_yoy_pct: 'Pertumbuhan pendapatan YoY',
  earnings_yoy_pct: 'Pertumbuhan laba bersih YoY',
  annual_earnings_yoy_pct: 'Pertumbuhan laba bersih tahunan',
  prior_fy_earnings_yoy_pct: 'Pertumbuhan laba bersih tahun sebelumnya',
  earnings_minus_revenue_growth_pp: 'Selisih pertumbuhan laba dan pendapatan',
  net_margin_change_pp: 'Perubahan margin bersih',
  roe_trend_pp: 'Perubahan ROE',
  dividend_yield_pct: 'Yield dividen 12 bulan terakhir',
  dividend_yield_hist_avg_pct: 'Rata-rata yield dividen',
  yield_change_pct: 'Perubahan yield dividen',
  dps_change_pct: 'Perubahan dividen per saham',
  payout_ratio_pct: 'Rasio pembayaran dividen',
  target_pe: 'P/E',
  peer_count: 'Perusahaan pembanding yang valid',
  pe_vs_peer_median_pct: 'P/E dibanding median perusahaan pembanding',
  pbv_vs_peer_median_pct: 'P/BV dibanding median perusahaan pembanding',
  roe_vs_peer_median_pp: 'ROE dibanding median perusahaan pembanding',
  pe_vs_own_history_pct: 'P/E dibanding riwayat sendiri',
  drawdown_from_52w_high_pct: 'Perubahan dari harga tertinggi 52 minggu',
};

export const metricLabel = (m: string, language: Language = 'id') => translate(language, METRICS[m] ?? m.replace(/_/g, ' '));

/** Derived metrics only: raw inputs (revenue, net income) stay in the evidence drawer. */
export const isHeadlineMetric = (m: string) => m in METRICS;

const CMP: Record<NonNullable<ChangeCondition['comparator']>, string> = {
  at_least: 'minimal',
  above: 'di atas',
  at_most: 'maksimal',
  below: 'di bawah',
};

export function conditionText(c: ChangeCondition, language: Language = 'id'): string {
  const t = (message: string, values?: Record<string, string | number>) => translate(language, message, values);
  if (c.effect === 'missing_evidence' || c.comparator === null || c.threshold === null || c.current === null) {
    return t('{label} belum tersedia. Data ini diperlukan untuk melengkapi pemeriksaan.', { label: t(c.label) });
  }
  const effect = t(c.effect === 'would_support' ? 'agar mendukung klaim' : 'agar tidak lagi melemahkan klaim');
  const when = c.period ? ` (${c.period})` : '';
  return t('{label} perlu {comparator} {threshold} {effect}. Saat ini {current}{period}.', { label: t(c.label), comparator: t(CMP[c.comparator]), threshold: formatValue(c.threshold, c.unit ?? 'percent'), effect, current: formatValue(c.current, c.unit ?? 'percent'), period: when });
}
