'use client';
import Link from 'next/link';
import Image from 'next/image';
import { History, Plus, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher, useLanguage } from './LanguageProvider';
import { isWorkspacePath } from '@/lib/routes';
import { ThemeSwitcher } from './ThemeProvider';
import { useAuth } from './AuthProvider';

const LANDING_SECTIONS = [
  { id: 'how-it-works', label: 'Cara kerja' },
  { id: 'reading-results', label: 'Cara membaca hasil' },
  { id: 'faq', label: 'FAQ' },
];

/**
 * On the landing page the header floats over the hero, gains a surface once the page scrolls,
 * and marks the section crossing the middle of the viewport so the reader knows where they are.
 */
function useLandingScroll(enabled: boolean) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
        else setActiveSection((current) => (current === entry.target.id ? null : current));
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (const { id } of LANDING_SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      setActiveSection(null);
    };
  }, [enabled]);
  return { scrolled, activeSection };
}

export function AppHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { user, status, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isLanding = pathname === '/';
  const isAuth = pathname === '/sign-in' || pathname === '/sign-up';
  // Signed-in workspace screens use the sidebar shell instead of this header.
  const inWorkspace = isWorkspacePath(pathname);
  const { scrolled, activeSection } = useLandingScroll(isLanding);
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(); } catch { setError(t('Keluar gagal. Coba lagi.')); }
    finally { setBusy(false); }
  }
  if (inWorkspace) return null;
  return <>
    <a className="skip-link" href="#main-content">{t('Langsung ke konten')}</a>
    <header className={`app-header${isLanding ? ' landing-header' : ''}`} data-scrolled={(isLanding && scrolled) || undefined}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Counterpoint">
          <Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority />
        </Link>
        {isLanding && <nav className="landing-header-nav" aria-label={t('Tentang produk')}>{LANDING_SECTIONS.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined}>{t(label)}</a>)}</nav>}
        <div className="header-actions">
          <ThemeSwitcher />
          <LanguageSwitcher />
          {user ? <div className="header-account"><span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span className="account-name" title={user.email}>{user.name}</span><button className="quiet" disabled={busy} onClick={() => void logout()} aria-label={t('Keluar')} title={t('Keluar')}><LogOut size={17} aria-hidden="true" /></button></div> : status !== 'loading' && !isAuth && !isLanding && <Link className="button quiet" href="/sign-in">{t('Masuk')}</Link>}
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
