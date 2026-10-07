import type { Coverage } from './api';
import { translate, type Language } from './locale';

const STOP_LABELS: Record<string, string> = {
  SUFFICIENT: 'Bukti sudah cukup untuk menilai klaim', UNOBTAINABLE: 'Data yang diperlukan belum tersedia',
  DUPLICATE: 'Pemeriksaan ini sudah dilakukan', OUT_OF_SCOPE: 'Klaim berada di luar cakupan pemeriksaan',
  BUDGET_EXHAUSTED: 'Batas jumlah pemeriksaan tercapai', TIMEOUT: 'Batas waktu pemeriksaan tercapai', ERROR: 'Pemeriksaan mengalami kendala',
};
export function stopReasonLabel(reason: string, language: Language) { return translate(language, STOP_LABELS[reason] ?? 'Pemeriksaan dihentikan'); }
export function coverageLabel(coverage: Coverage, language: Language) {
  return translate(language, coverage.required === 0 ? 'Tidak ada pemeriksaan bukti yang berlaku untuk klaim ini.' : '{completed} dari {required} pemeriksaan wajib tersedia', { completed: coverage.completed, required: coverage.required });
}
