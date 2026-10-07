'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, FileText, History, LoaderCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, type HistoryPage as HistoryResult } from '@/lib/api';

const FINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);
const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Pesan diterima', AWAITING_CONFIRMATION: 'Perlu konfirmasi saham', CLAIMS_EXTRACTED: 'Siap diperiksa',
  INVESTIGATING: 'Sedang diperiksa', COMPLETED: 'Selesai', PARTIAL: 'Selesai sebagian', FAILED: 'Terhenti',
};
export default function HistoryPage() {
  const { language, t } = useLanguage();
  const [data, setData] = useState<HistoryResult | null>(null);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api.getHistory(page, search, filter, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (page > pages) { setPage(pages); return; }
      setData(result);
    }).catch(() => { if (!controller.signal.aborted) setError('Riwayat belum dapat dimuat. Coba lagi.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search, filter, refresh]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 12));
  const formatDate = (date: string) => new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  return <main id="main-content" className="page history-page">
    <header className="page-heading history-heading"><div><span className="eyebrow">{t('Pemeriksaan sebelumnya')}</span><h1>{t('Riwayat pemeriksaan')}</h1><p>{t('Buka kembali pesan, proses pemeriksaan, dan laporan bukti yang pernah kamu lihat.')}</p></div><Link href="/check" className="button primary">{t('Pemeriksaan baru')}<ArrowRight size={17} aria-hidden="true" /></Link></header>
    <p className="history-local small muted"><ShieldCheck size={16} aria-hidden="true" />{t('Riwayat tersimpan di akunmu dan bisa dibuka dari perangkat lain setelah masuk.')}</p>
    <div className="sheet history-controls"><label className="history-search"><Search size={18} aria-hidden="true" /><span className="visually-hidden">{t('Cari pesan atau kode saham')}</span><input type="search" maxLength={200} value={query} placeholder={t('Cari pesan atau kode saham')} onChange={(event) => setQuery(event.target.value)} /></label><label className="history-filter"><span className="visually-hidden">{t('Filter riwayat')}</span><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">{t('Semua pemeriksaan')}</option><option value="reports">{t('Ada laporan')}</option><option value="active">{t('Belum selesai')}</option><option value="failed">{t('Terhenti')}</option></select></label><button className="quiet" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} className={loading ? 'spin' : undefined} aria-hidden="true" />{t('Perbarui status')}</button></div>
    {error && <p className="notice" role="alert">{t(error)}</p>}
    <p className="small muted history-count" role="status">{loading ? t('Memuat riwayat…') : !error && data ? t('{count} pemeriksaan ditemukan', { count: data.total }) : ''}</p>
    {loading ? <div className="sheet history-empty" role="status"><LoaderCircle className="spin" size={26} aria-hidden="true" /><p>{t('Memuat riwayat…')}</p></div> : !error && data && (!data.items.length ? <div className="sheet history-empty"><History size={32} aria-hidden="true" /><h2>{t(search || filter !== 'all' ? 'Tidak ada hasil yang cocok' : 'Belum ada riwayat pemeriksaan')}</h2><p>{t(search || filter !== 'all' ? 'Coba kata kunci lain atau ubah filter.' : 'Mulai dengan memeriksa pesan saham. Kamu bisa membuka hasilnya lagi dari halaman ini.')}</p><Link className="button primary" href="/check">{t('Cek klaim')}<ArrowRight size={16} aria-hidden="true" /></Link></div> : <ul className="history-list">{data.items.map((entry) => <li key={entry.id} className="sheet history-card"><div className="history-card-body"><div className="history-meta"><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>{entry.tickers.map((ticker) => <span className="history-ticker" key={ticker}>{ticker}</span>)}<span className="history-status" data-status={entry.status}>{t(STATUS_LABELS[entry.status] ?? 'Status belum diketahui')}</span></div><h2><Link href={entry.reportId ? `/t/${entry.id}/report` : `/t/${entry.id}`}>{entry.text}</Link></h2></div><div className="history-card-actions"><Link className="button quiet" href={`/t/${entry.id}`}>{t(FINAL.has(entry.status) ? 'Lihat pemeriksaan' : 'Buka pemeriksaan')}<ArrowRight size={15} aria-hidden="true" /></Link>{entry.reportId && <Link className="button primary" href={`/t/${entry.id}/report`}><FileText size={16} aria-hidden="true" />{t('Baca laporan')}</Link>}</div></li>)}</ul>)}
    {!loading && !error && pages > 1 && <nav className="history-pagination" aria-label={t('Halaman riwayat')}><button className="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" />{t('Sebelumnya')}</button><span className="small muted">{t('Halaman {page} dari {total}', { page, total: pages })}</span><button className="quiet" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Berikutnya')}<ChevronRight size={16} aria-hidden="true" /></button></nav>}
  </main>;
}
