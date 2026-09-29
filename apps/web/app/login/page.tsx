'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Brand } from '@/components/Brand';

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="auth">
      <div className="card">
        <Brand />
        <h1 style={{ fontSize: '1.5rem', marginTop: 20 }}>Welcome back</h1>
        <p className="muted" style={{ marginTop: 0 }}>Sign in to your research dashboard.</p>
        <form
          className="stack"
          style={{ marginTop: 20 }}
          onSubmit={(e) => {
            e.preventDefault();
            router.push('/app');
          }}
        >
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" defaultValue="demo@counterpoint.id" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" defaultValue="demo-password" autoComplete="off" />
          </div>
          <button type="submit" style={{ width: '100%' }}>
            Sign in <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 16, marginBottom: 0 }}>
          Demo account: accounts are not enabled yet, so any details open the dashboard and nothing is stored.
        </p>
        <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
