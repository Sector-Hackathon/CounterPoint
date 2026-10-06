'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ScreenshotDrop } from '@/components/ScreenshotDrop';

const EXAMPLES = {
  id: 'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.',
  en: 'BBRI looks attractive because growth is strong and its valuation is cheap compared with other large banks. Its price will rise to 6000.',
};

export default function Home() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
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
    <main className="page" style={{ display: 'grid', gap: 28, maxWidth: 880 }}>
      <h1>{t('Setiap klaim saham perlu diperiksa.')}</h1>
      <p style={{ fontSize: '1.15rem', color: 'var(--ink-2)' }}>
        {t('Tempel pesan saham dari Stockbit, X, atau grup Telegram. Counterpoint memecahnya menjadi klaim, memeriksa data Sectors, lalu menguji alasan yang dapat melemahkannya.')}
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void submit(thesis); }} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="thesis" className="visually-hidden">{t('Pesan atau tesis saham')}</label>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={5}
          minLength={10}
          maxLength={2000}
          required
          placeholder={t('BBRI masih menarik karena…')}
          style={{ font: 'inherit', fontSize: '1.1rem', padding: 18, borderRadius: 'var(--r-sheet)', border: 0, background: 'var(--paper-raised)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--rule)', resize: 'vertical' }}
        />
        <ScreenshotDrop onText={setThesis} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" disabled={busy || thesis.trim().length < 10}>{busy ? t('Membaca pesan…') : t('Cek klaim')}</button>
          <button type="button" className="quiet" disabled={busy} onClick={() => { const example = EXAMPLES[language]; setThesis(example); void submit(example); }}>
            {t('Coba contoh')}
          </button>
        </div>
        {error && <p role="alert" style={{ color: 'var(--resolve)' }}>{error}</p>}
      </form>
      <p className="muted small">{t('Informasi dan analisis saja. Counterpoint tidak memberikan rekomendasi beli, jual, atau tahan saham.')}</p>
    </main>
  );
}
