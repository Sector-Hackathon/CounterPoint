'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const EXAMPLE = 'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain.';

export default function Landing() {
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
      router.push(`/theses/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Paste a stock thesis. See which parts the evidence supports.</h1>
      <p className="muted">
        Counterpoint splits a thesis into testable claims, checks each against Sectors company data, actively looks for
        counterevidence, and says clearly when a claim cannot be verified.
      </p>

      <form onSubmit={submit} className="card">
        <label htmlFor="thesis">
          <strong>Stock thesis</strong> <span className="muted">(Bahasa Indonesia or English)</span>
        </label>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder={EXAMPLE}
          minLength={10}
          maxLength={2000}
          required
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="submit" disabled={busy || thesis.trim().length < 10}>
            {busy ? 'Starting…' : 'Verify thesis'}
          </button>
          <button type="button" className="secondary" onClick={() => setThesis(EXAMPLE)}>
            Use example
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      <p className="notice">
        Information and analysis only. Counterpoint checks evidence behind claims you provide; it does not recommend
        buying, selling, or holding any security.
      </p>
    </main>
  );
}
