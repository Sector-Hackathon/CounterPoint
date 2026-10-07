'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileText, Search, ShieldCheck, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ScreenshotDrop } from '@/components/ScreenshotDrop';
import { FlowSteps } from '@/components/FlowSteps';

const EXAMPLES = {
  id: 'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.',
  en: 'BBRI looks attractive because growth is strong and its valuation is cheap compared with other large banks. Its price will rise to 6000.',
};

const BENEFITS = [
  { Icon: FileText, title: 'Klaim yang lebih jelas', description: 'Pesan dipecah menjadi klaim yang bisa diperiksa.' },
  { Icon: Search, title: 'Bukti dari dua sisi', description: 'Lihat data pendukung dan alasan yang melemahkan klaim.' },
  { Icon: ShieldCheck, title: 'Batasan yang terlihat', description: 'Ketahui data yang belum tersedia sebelum menarik kesimpulan.' },
];

export default function Home() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusAfterUpload = useRef(false);
  useEffect(() => { if (!readingImage && !busy && focusAfterUpload.current) { focusAfterUpload.current = false; inputRef.current?.focus(); } }, [readingImage, busy, thesis]);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    if (busy || readingImage || text.trim().length < 10 || text.length > 2000) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.createThesis(text);
      router.push(`/t/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="page input-page">
      <FlowSteps current={0} />
      <header className="page-heading">
        <span className="eyebrow">{t('Dari ajakan ke bukti')}</span>
        <h1>{t('Cek klaimnya sebelum ikut percaya.')}</h1>
        <p>{t('Tempel pesan saham yang kamu terima. Periksa apa yang didukung data, apa yang melemahkannya, dan apa yang belum diketahui.')}</p>
      </header>
      <div className="input-grid">
      <form className="sheet input-form" aria-busy={busy || readingImage} onSubmit={(e) => { e.preventDefault(); void submit(thesis); }}>
        <div className="section-heading"><label htmlFor="thesis">{t('Pesan yang ingin diperiksa')}</label><span className="small muted">{t('Langkah 1')}</span></div>
        <textarea
          id="thesis"
          ref={inputRef}
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={7}
          minLength={10}
          maxLength={2000}
          required
          disabled={busy || readingImage}
          aria-describedby="thesis-help thesis-count"
          placeholder={t('BBRI masih menarik karena…')}
          className="thesis-input"
        />
        <div className="input-help small muted"><span id="thesis-help">{t(thesis.length > 2000 ? 'Pesan melebihi 2000 karakter. Ringkas teks sebelum memeriksa.' : 'Sertakan nama saham dan alasan yang ingin dicek. Minimal 10 karakter.')}</span><span id="thesis-count" className="tabular">{thesis.length}/2000</span></div>
        <ScreenshotDrop disabled={busy} onBusyChange={setReadingImage} onText={(text) => { focusAfterUpload.current = true; setThesis(text); setError(null); }} />
        {error && <p className="notice" role="alert">{error}</p>}
        <div className="form-footer">
          <span className="small muted">{t('Bukti pendukung dan pelemah dalam satu laporan.')}</span>
          <button className="primary" type="submit" disabled={busy || readingImage || thesis.trim().length < 10 || thesis.length > 2000}>
            {busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
            {busy ? t('Membaca pesan…') : t('Cek klaim')}<ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </form>
      <aside className="input-aside">
        <h2>{t('Yang akan kamu dapatkan')}</h2>
        <ul className="benefit-list">
          {BENEFITS.map(({ Icon, title, description }) => <li key={title}><span className="benefit-icon"><Icon size={19} aria-hidden="true" /></span><div><strong>{t(title)}</strong><p>{t(description)}</p></div></li>)}
        </ul>
        <div className="example-box"><span className="eyebrow">{t('Belum punya pesan?')}</span><p>{EXAMPLES[language]}</p>
          <button type="button" className="quiet" disabled={busy || readingImage} onClick={() => { setThesis(EXAMPLES[language]); setError(null); inputRef.current?.focus(); }}>{t('Isi dengan contoh')}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </aside>
      </div>
      <p className="page-disclaimer small muted"><ShieldCheck size={16} aria-hidden="true" />{t('Informasi dan analisis saja. Counterpoint tidak memberikan rekomendasi beli, jual, atau tahan saham.')}</p>
    </main>
  );
}
