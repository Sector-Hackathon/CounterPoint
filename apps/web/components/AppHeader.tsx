'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, History, Plus, LogOut } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher, useLanguage } from './LanguageProvider';
import { ThemeSwitcher } from './ThemeProvider';
import { useAuth } from './AuthProvider';

export function AppHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { user, status, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isLanding = pathname === '/';
  const isAuth = pathname === '/sign-in' || pathname === '/sign-up';
  // Signed-in workspace screens use the sidebar shell instead of this header.
  const inWorkspace = pathname === '/check' || pathname === '/history' || pathname.startsWith('/t/');
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(); } catch { setError(t('Keluar gagal. Coba lagi.')); }
    finally { setBusy(false); }
  }
  if (inWorkspace) return null;
  return <>
    <a className="skip-link" href="#main-content">{t('Langsung ke konten')}</a>
    <header className={`app-header${isLanding ? ' landing-header' : ''}`}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Counterpoint">
          <Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority />
        </Link>
        {isLanding && <nav className="landing-header-nav" aria-label={t('Tentang produk')}><a href="#why-counterpoint">{t('Kenapa Counterpoint')}</a><a href="#how-it-works">{t('Cara kerja')}</a><a href="#faq">{t('FAQ')}</a></nav>}
        <div className="header-actions">
          <LanguageSwitcher />
          <ThemeSwitcher />
          {user ? <div className="header-account"><span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span className="account-name" title={user.email}>{user.name}</span><button className="quiet" disabled={busy} onClick={() => void logout()} aria-label={t('Keluar')} title={t('Keluar')}><LogOut size={17} aria-hidden="true" /></button></div> : status !== 'loading' && !isAuth && !isLanding && <Link className="button quiet" href="/sign-in">{t('Masuk')}</Link>}
          {/* One entry point on the landing page: /check sends signed-out visitors to sign-in, which links to sign-up. */}
          {isLanding && <Link href="/check" className="button primary landing-header-cta">{t('Buka aplikasi')}<ArrowRight size={17} aria-hidden="true" /></Link>}
        </div>
      </div>
      {!isLanding && !isAuth && <nav className="app-tabs" aria-label={t('Navigasi utama')}>
        <Link href="/check" aria-current={pathname === '/check' || pathname.startsWith('/t/') ? 'page' : undefined}><Plus size={16} aria-hidden="true" />{t('Pemeriksaan baru')}</Link>
        <Link href="/history" aria-current={pathname === '/history' ? 'page' : undefined}><History size={16} aria-hidden="true" />{t('Riwayat')}</Link>
      </nav>}
      {error && <p className="header-auth-error" role="alert">{error}</p>}
    </header>
  </>;
}
