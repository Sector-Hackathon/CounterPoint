'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, UserRound, LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const signup = mode === 'sign-up';
  const { t } = useLanguage(); const { user, acceptUser } = useAuth();
  const router = useRouter(); const params = useSearchParams();
  const requested = params.get('next') ?? '/check';
  const next = /^\/(check|history)(\?|$)/.test(requested) || /^\/t\/[a-f0-9-]+(\/report)?$/.test(requested) ? requested : '/check';
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError('');
    if (signup && password !== confirmation) { setError(t('Konfirmasi password tidak cocok.')); return; }
    setBusy(true);
    try {
      const result = signup ? await api.signUp(name.trim(), email.trim(), password) : await api.signIn(email.trim(), password);
      // Confirm the browser accepted the cookie before opening protected pages.
      const current = await api.me();
      if (!current.user || current.user.id !== result.user.id) throw new Error(t('Sesi login tidak tersimpan. Periksa pengaturan cookie browser.'));
      acceptUser(current.user); router.replace(next);
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t('Tidak dapat terhubung ke server. Coba lagi.')); }
    finally { setBusy(false); }
  }
  return <main id="main-content" className="auth-page page">
    <section className="sheet auth-card" aria-labelledby="auth-title"><div className="auth-icon" aria-hidden="true">{signup ? <UserRound size={24} /> : <LogIn size={24} />}</div><h1 id="auth-title">{t(signup ? 'Buat akunmu' : 'Selamat datang kembali')}</h1><p className="muted">{t(signup ? 'Daftar untuk menyimpan pemeriksaan dan riwayatmu.' : 'Masuk untuk melanjutkan pemeriksaan dan melihat riwayatmu.')}</p>
      <form onSubmit={submit}>
        {signup && <label>{t('Nama')}<input autoComplete="name" name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} disabled={busy} /></label>}
        <label>{t('Email')}<input type="email" autoComplete="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={busy} /></label>
        <label>{t('Password')}<span className="auth-password"><input type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} name="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={signup ? 10 : 1} maxLength={128} disabled={busy} /><button type="button" className="quiet" onClick={() => setVisible(!visible)} aria-label={t(visible ? 'Sembunyikan password' : 'Tampilkan password')} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        {signup && <><p className="small muted auth-hint">{t('Gunakan minimal 10 karakter untuk password.')}</p><label>{t('Konfirmasi password')}<input type={visible ? 'text' : 'password'} autoComplete="new-password" name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required maxLength={128} disabled={busy} /></label></>}
        {error && <p className="notice" role="alert">{error}</p>}
        <button type="submit" className="primary auth-submit" disabled={busy}>{t(busy ? 'Mohon tunggu…' : signup ? 'Buat akun' : 'Masuk')}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <p className="auth-switch">{t(signup ? 'Sudah punya akun?' : 'Belum punya akun?')} <Link href={`/${signup ? 'sign-in' : 'sign-up'}?next=${encodeURIComponent(next)}`}>{t(signup ? 'Masuk' : 'Daftar')}</Link></p>
    </section>
  </main>;
}
