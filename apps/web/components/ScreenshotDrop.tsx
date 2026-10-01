'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export function ScreenshotDrop({ onText }: { onText: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Use a PNG, JPEG or WebP screenshot.');
    if (file.size > 4 * 1024 * 1024) return setError('Screenshot is over 4 MB. Crop it and try again.');
    setBusy(true);
    setError(null);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = () => rej(new Error('Could not read the file.'));
        r.readAsDataURL(file);
      });
      const { text } = await api.extractText(b64, file.type);
      onText(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void read(f); }}
      style={{ display: 'block', padding: 16, borderRadius: 'var(--r-sheet)', boxShadow: 'inset 0 0 0 1px var(--rule)', cursor: 'pointer' }}
    >
      <input type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
      {busy ? 'Reading the screenshot…' : 'Or drop a screenshot of the post'}
      {error && <span role="alert" style={{ display: 'block', color: 'var(--resolve)' }}>{error}</span>}
    </label>
  );
}
