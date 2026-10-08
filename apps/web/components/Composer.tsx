'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from './LanguageProvider';
import { pastedImage } from '@/lib/pasted-image';
import { ScreenshotDrop, type ScreenshotReader } from './ScreenshotDrop';

const MIN = 10;
const MAX = 2000;

/**
 * The thesis input: grows with its text, Enter checks, Shift+Enter adds a line, the paperclip
 * (or a pasted image) reads a screenshot into the box for the user to edit first. Used on the start screen and at
 * the foot of a check.
 */
export function Composer({ prefill, compact = false, autoFocus = false }: {
  prefill?: { text: string; nonce: number };
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const screenshot = useRef<ScreenshotReader>(null);

  useEffect(() => {
    if (!prefill) return;
    setThesis(prefill.text);
    setError(null);
    inputRef.current?.focus();
  }, [prefill]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [thesis]);

  const tooShort = thesis.trim().length < MIN;
  const tooLong = thesis.length > MAX;
  const blocked = busy || readingImage;

  async function submit() {
    if (blocked || tooShort || tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.createThesis(thesis);
      setThesis('');
      router.push(`/t/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hintId = compact ? 'composer-hint-foot' : 'composer-hint';
  return (
    <>
      <form className="composer" data-compact={compact} aria-busy={blocked} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label htmlFor={compact ? 'thesis-foot' : 'thesis'} className="visually-hidden">{t('Pesan yang ingin diperiksa')}</label>
        <textarea
          id={compact ? 'thesis-foot' : 'thesis'}
          ref={inputRef}
          value={thesis}
          rows={compact ? 1 : 2}
          maxLength={MAX + 200}
          disabled={blocked}
          autoFocus={autoFocus}
          placeholder={t(compact ? 'Periksa pesan saham lain…' : 'Tempel pesan saham yang ingin kamu periksa…')}
          aria-describedby={hintId}
          onChange={(e) => setThesis(e.target.value)}
          onPaste={(e) => {
            const image = pastedImage(e.clipboardData);
            if (image) { e.preventDefault(); screenshot.current?.read(image); }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
          }}
        />
        <div className="composer-bar">
          <ScreenshotDrop ref={screenshot} variant="icon" disabled={busy} onBusyChange={setReadingImage} onText={(text) => { setThesis(text); setError(null); inputRef.current?.focus(); }} />
          <span className="tabular">{thesis.length > 0 ? `${thesis.length}/${MAX}` : ''}</span>
          <button type="submit" className="composer-send" disabled={blocked || tooShort || tooLong} aria-label={t('Cek klaim')} title={t('Cek klaim')}>
            {busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
          </button>
        </div>
      </form>
      <div className="composer-status">
        <p id={hintId} className="small muted" style={{ margin: 0 }}>
          {t(tooLong ? 'Pesan melebihi 2000 karakter. Ringkas teks sebelum memeriksa.' : 'Enter untuk memeriksa · Shift+Enter untuk baris baru · Tempel teks atau screenshot berisi nama saham dan alasannya.')}
        </p>
        {error && <p className="notice" role="alert">{error}</p>}
      </div>
    </>
  );
}
