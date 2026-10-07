'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { ScreenshotDrop } from '@/components/ScreenshotDrop';
import { api } from '@/lib/api';

const EXAMPLES = {
  id: [
    'TLKM dividennya tinggi dan growth kuat, valuasinya juga murah dibanding emiten telco lain.',
    'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.',
    'BBCA growth kuat dan dividennya stabil, layak dikoleksi.',
  ],
  en: [
    'TLKM pays a high dividend and growth is strong; its valuation is also cheap versus other telcos.',
    'BBRI looks attractive because growth is strong and its valuation is cheap compared with other large banks. Its price will rise to 6000.',
    'BBCA growth is strong and its dividend is stable, worth accumulating.',
  ],
};

const MIN = 10;
const MAX = 2000;

export default function Start() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Grow the box with its content, like a chat composer.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [thesis]);

  const tooShort = thesis.trim().length < MIN;
  const tooLong = thesis.length > MAX;
  const blocked = busy || readingImage;

  async function submit(text: string) {
    if (blocked || text.trim().length < MIN || text.length > MAX) return;
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
    <main id="main-content" className="start">
      <div className="start-brand"><Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority /></div>
      <p className="start-lead">{t('Tempel pesan saham. Counterpoint memeriksa setiap klaim dengan data Sectors dan mencari bukti yang melemahkannya.')}</p>

      <form className="composer" aria-busy={blocked} onSubmit={(e) => { e.preventDefault(); void submit(thesis); }}>
        <label htmlFor="thesis" className="visually-hidden">{t('Pesan yang ingin diperiksa')}</label>
        <textarea
          id="thesis"
          ref={inputRef}
          value={thesis}
          rows={2}
          maxLength={MAX + 200}
          disabled={blocked}
          placeholder={t('Tempel pesan saham yang ingin kamu periksa…')}
          aria-describedby="thesis-hint"
          onChange={(e) => setThesis(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(thesis); }
          }}
        />
        <div className="composer-bar">
          <ScreenshotDrop variant="icon" disabled={busy} onBusyChange={setReadingImage} onText={(text) => { setThesis(text); setError(null); inputRef.current?.focus(); }} />
          <span className="tabular" aria-hidden={thesis.length === 0}>{thesis.length > 0 ? `${thesis.length}/${MAX}` : ''}</span>
          <button type="submit" className="composer-send" disabled={blocked || tooShort || tooLong} aria-label={t('Cek klaim')} title={t('Cek klaim')}>
            {busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
          </button>
        </div>
      </form>
      <div className="composer-status">
        <p id="thesis-hint" className="small muted" style={{ margin: 0 }}>
          {t(tooLong ? 'Pesan melebihi 2000 karakter. Ringkas teks sebelum memeriksa.' : 'Enter untuk memeriksa · Shift+Enter untuk baris baru · Sertakan nama saham dan alasannya.')}
        </p>
        {error && <p className="notice" role="alert">{error}</p>}
      </div>

      <div className="examples" role="group" aria-label={t('Contoh pesan')}>
        {EXAMPLES[language].map((example) => (
          <button key={example} type="button" disabled={blocked} onClick={() => { setThesis(example); setError(null); inputRef.current?.focus(); }}>
            <span>{example}</span>
          </button>
        ))}
      </div>

      <p className="start-foot">{t('Informasi dan analisis saja. Counterpoint tidak memberikan rekomendasi beli, jual, atau tahan saham.')}</p>
    </main>
  );
}
