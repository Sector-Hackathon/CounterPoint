'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from './LanguageProvider';

export function AppHeader() {
  const { t } = useLanguage();
  return <>
    <a className="skip-link" href="#main-content">{t('Langsung ke konten')}</a>
    <header className="app-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Counterpoint">
          <Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority />
        </Link>
        <div className="header-actions">
          <LanguageSwitcher />
          <Link href="/" className="header-new">{t('Cek pesan baru')}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </header>
  </>;
}
