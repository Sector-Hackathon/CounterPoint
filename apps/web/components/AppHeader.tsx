'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from './LanguageProvider';
import { ThemeSwitcher } from './ThemeProvider';
import { usePathname } from 'next/navigation';

export function AppHeader() {
  const { t } = useLanguage();
  const isLanding = usePathname() === '/';
  return <>
    <a className="skip-link" href="#main-content">{t('Langsung ke konten')}</a>
    <header className={isLanding ? "app-header landing-header" : "app-header"}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Counterpoint">
          <Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority />
        </Link>
        <div className="header-actions">
          {isLanding && <nav className="landing-header-nav" aria-label={t('Tentang produk')}><a href="#why-counterpoint">{t('Kenapa Counterpoint')}</a><a href="#how-it-works">{t('Cara kerja')}</a></nav>}
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Link href="/check" className="header-new">{t('Cek pesan baru')}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </header>
  </>;
}
