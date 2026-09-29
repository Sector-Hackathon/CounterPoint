'use client';

import { useRouter } from 'next/navigation';
import { PreviewBanner } from '@/components/SiteNav';

export default function LoginPage() {
  const router = useRouter();
  return (
    <main style={{ maxWidth: 420 }}>
      <PreviewBanner>Accounts are not enabled yet. Signing in here opens the workspace preview; nothing is stored.</PreviewBanner>
      <h1>Sign in</h1>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          router.push('/workspace');
        }}
      >
        <label htmlFor="email"><strong>Email</strong></label>
        <input id="email" type="email" placeholder="you@example.com" autoComplete="off" />
        <label htmlFor="password" style={{ display: 'block', marginTop: 12 }}><strong>Password</strong></label>
        <input id="password" type="password" autoComplete="off" />
        <button type="submit" style={{ marginTop: 16, width: '100%' }}>Continue to workspace preview</button>
      </form>
    </main>
  );
}
