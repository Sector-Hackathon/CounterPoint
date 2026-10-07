'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useRef, useState } from 'react';
import { Upload, LoaderCircle, Check, Paperclip } from 'lucide-react';
import { api } from '@/lib/api';

export function ScreenshotDrop({ onText, disabled = false, onBusyChange, variant = 'zone' }: { onText: (text: string) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void; variant?: 'zone' | 'icon' }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function read(file: File) {
    if (disabled || inFlight.current) return;
    setFilename(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Gunakan screenshot PNG, JPEG, atau WebP.');
    if (file.size > 4 * 1024 * 1024) return setError('Screenshot melebihi 4 MB. Potong gambar lalu coba lagi.');
    setBusy(true);
    inFlight.current = true;
    onBusyChange?.(true);
    setError(null);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = () => rej(new Error('File tidak dapat dibaca.'));
        r.readAsDataURL(file);
      });
      const { text } = await api.extractText(b64, file.type);
      onText(text);
      setFilename(file.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      inFlight.current = false;
      onBusyChange?.(false);
    }
  }

  if (variant === 'icon') {
    // Compact paperclip for the composer bar; status stays next to it, announced politely.
    return (
      <>
        <label className="attach icon-button" title={t('Unggah screenshot')} data-disabled={disabled || busy}>
          {busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <Paperclip size={18} aria-hidden="true" />}
          <input type="file" disabled={disabled || busy} accept="image/png,image/jpeg,image/webp" aria-label={t('Unggah screenshot')}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
        </label>
        <span className="small muted" aria-live="polite">
          {busy ? t('Membaca screenshot…') : filename ? t('Teks dari screenshot siap diedit.') : ''}
        </span>
        {error && <span role="alert" className="small" style={{ color: 'var(--resolve)' }}>{t(error)}</span>}
      </>
    );
  }

  return (
    <div>
    <label className="screenshot-upload" data-disabled={disabled || busy}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); if (disabled || busy || inFlight.current) return; const file = event.dataTransfer.files[0]; if (file) void read(file); }}>
      <span className="upload-icon">{busy ? <LoaderCircle size={19} className="spin" aria-hidden="true" /> : <Upload size={19} aria-hidden="true" />}</span>
      <span>
        <strong>{busy ? t('Membaca screenshot…') : t('Punya screenshot? Unggah di sini')}</strong>
        <span className="small muted">{t('Pilih atau tarik gambar · PNG, JPEG, WebP · maks. 4 MB')}</span>
      </span>
      <input type="file" disabled={disabled || busy} accept="image/png,image/jpeg,image/webp" className="upload-input"
      aria-label={t('Punya screenshot? Unggah di sini')}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
    </label>
    <div aria-live="polite">{busy && <p className="small muted">{t('Membaca screenshot…')}</p>}
      {filename && <p className="upload-result small"><Check size={15} aria-hidden="true" />{filename} · {t('Teks siap diedit sebelum diperiksa.')}</p>}
    </div>
    {error && <p role="alert" className="notice small">{t(error)}</p>}
    </div>
  );
}
