'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const EXAMPLE = 'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.';

export default function Home() {
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
      <h1>Every stock thesis has a counterpoint.</h1>
      <p style={{ fontSize: '1.15rem', color: 'var(--ink-2)' }}>
        Paste a thesis from Stockbit, X or your Telegram group. Counterpoint splits it into claims, checks each one against
        Sectors data, and builds the strongest case against it.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void submit(thesis); }} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="thesis" className="visually-hidden">Stock thesis</label>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={5}
          minLength={10}
          maxLength={2000}
          required
          placeholder="BBRI masih menarik karena…"
          style={{ font: 'inherit', fontSize: '1.1rem', padding: 18, borderRadius: 'var(--r-sheet)', border: 0, background: 'var(--paper-raised)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--rule)', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" disabled={busy || thesis.trim().length < 10}>{busy ? 'Reading the thesis…' : 'Check this thesis'}</button>
          <button type="button" className="quiet" disabled={busy} onClick={() => { setThesis(EXAMPLE); void submit(EXAMPLE); }}>
            Try a real example
          </button>
        </div>
        {error && <p role="alert" style={{ color: 'var(--resolve)' }}>{error}</p>}
      </form>
      <p className="muted small">Information and analysis only. Counterpoint never tells you to buy, sell or hold.</p>
    </main>
  );
}
