'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api';

const EXAMPLES = [
  'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain.',
  'BBRI dividennya tinggi dan harga akan naik ke 6000 tahun depan.',
  'BBCA keeps delivering strong earnings growth and its valuation is cheap versus peers.',
];

export default function NewCheck() {
  const router = useRouter();
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.createThesis(thesis);
      router.push(`/app/theses/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New check</h1>
          <p className="muted">Paste a stock thesis. The agent splits it into claims and investigates each against Sectors data.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card stack">
        <div>
          <label htmlFor="thesis">Stock thesis <span className="muted" style={{ fontWeight: 400 }}>(Bahasa Indonesia or English)</span></label>
          <textarea
            id="thesis"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="e.g. BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain."
            minLength={10}
            maxLength={2000}
            required
          />
          <div className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>{thesis.length}/2000</div>
        </div>
        <div className="row">
          <button type="submit" disabled={busy || thesis.trim().length < 10}>
            {busy ? 'Starting…' : <>Verify thesis <ArrowRight size={18} aria-hidden="true" /></>}
          </button>
        </div>
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </form>

      <h2>Try an example</h2>
      <div className="grid">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="secondary" style={{ justifyContent: 'flex-start', textAlign: 'left', fontWeight: 500 }} onClick={() => setThesis(ex)}>
            <Lightbulb size={16} aria-hidden="true" style={{ color: 'var(--highlight)', flexShrink: 0 }} />
            {ex}
          </button>
        ))}
      </div>

      <p className="notice" style={{ marginTop: 24 }}>
        Information and analysis only. Counterpoint checks the evidence behind claims you provide; it does not recommend buying,
        selling, or holding any security.
      </p>
    </>
  );
}
