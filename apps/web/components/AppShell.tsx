'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, LogOut, Menu, Monitor, Moon, PanelLeftClose, Plug, Search, Send, SquarePen, Sun, X } from 'lucide-react';
import { api, type HistoryEntry } from '@/lib/api';
import { GROUP_LABEL, groupByDate } from '@/lib/history-groups';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

const ACTIVE = new Set(['CREATED', 'INVESTIGATING']);

/** Workspace frame for signed-in screens: sidebar of past checks + main area. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell" data-collapsed={collapsed}>
      <a className="skip-link" href="#main-content">{t('Langsung ke konten')}</a>
      <div className="shell-topbar">
        <button type="button" className="icon-button" aria-label={t('Buka menu')} aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} aria-hidden="true" /></button>
        <Link href="/check" className="shell-brand" aria-label="Counterpoint"><Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority /></Link>
        <Link href="/check" className="icon-button" aria-label={t('Pemeriksaan baru')}><SquarePen size={19} aria-hidden="true" /></Link>
      </div>
      {open && <div className="shell-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <Sidebar open={open} onClose={() => setOpen(false)} onCollapse={() => setCollapsed(true)} />
      {collapsed && (
        <button type="button" className="icon-button shell-expand" aria-label={t('Tampilkan riwayat')} onClick={() => setCollapsed(false)}>
          <PanelLeftClose size={19} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
        </button>
      )}
      <div className="shell-atmos" data-variant={pathname === '/check' ? 'start' : 'page'} aria-hidden="true"><div className="shell-glow" /></div>
      <div className="shell-main">{children}</div>
    </div>
  );
}

function Sidebar({ open, onClose, onCollapse }: { open: boolean; onClose: () => void; onCollapse: () => void }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const currentId = pathname.startsWith('/t/') ? pathname.split('/')[2] : null;

  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      api.getHistory(1, query.trim(), 'all', controller.signal)
        .then((page) => { setEntries(page.items); setFailed(false); })
        .catch((err: Error) => { if (err.name !== 'AbortError') setFailed(true); });
    const timer = setTimeout(load, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, pathname]);

  // Keep running checks' marks fresh without reloading the page.
  const anyActive = entries?.some((e) => ACTIVE.has(e.status)) ?? false;
  useEffect(() => {
    if (!anyActive) return;
    const timer = setInterval(() => {
      api.getHistory(1, query.trim(), 'all').then((page) => setEntries(page.items)).catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [anyActive, query]);

  const groups = useMemo(() => groupByDate(entries ?? []), [entries]);

  return (
    <nav className="sidebar" data-open={open} aria-label={t('Riwayat pemeriksaan')}>
      <div className="sidebar-top">
        <Link href="/check" className="sidebar-brand" aria-label="Counterpoint"><Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority /></Link>
        <button type="button" className="icon-button sidebar-close" aria-label={t('Tutup menu')} onClick={onClose}><X size={19} aria-hidden="true" /></button>
        <button type="button" className="icon-button sidebar-collapse" aria-label={t('Sembunyikan riwayat')} onClick={onCollapse}><PanelLeftClose size={19} aria-hidden="true" /></button>
      </div>
      <Link href="/check" className="sidebar-new" aria-current={pathname === '/check' ? 'page' : undefined}><SquarePen size={17} aria-hidden="true" />{t('Pemeriksaan baru')}</Link>
      <label className="sidebar-search">
        <Search size={15} aria-hidden="true" />
        <span className="visually-hidden">{t('Cari pesan atau kode saham')}</span>
        <input type="search" value={query} maxLength={200} placeholder={t('Cari pemeriksaan')} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="sidebar-list">
        {entries === null && !failed && <p className="sidebar-note">{t('Memuat riwayat…')}</p>}
        {failed && <p className="sidebar-note" role="alert">{t('Riwayat tidak dapat dimuat.')}</p>}
        {entries && groups.length === 0 && <p className="sidebar-note">{t(query ? 'Tidak ada hasil yang cocok' : 'Belum ada pemeriksaan. Pemeriksaanmu akan muncul di sini.')}</p>}
        {groups.map((g) => (
          <section key={g.key} aria-label={t(GROUP_LABEL[g.key])}>
            <h2 className="sidebar-group">{t(GROUP_LABEL[g.key])}</h2>
            <ul>
              {g.items.map((e) => (
                <li key={e.id}>
                  <Link href={`/t/${e.id}`} className="sidebar-item" aria-current={e.id === currentId ? 'page' : undefined} title={e.text}>
                    {e.tickers[0] && <span className="sidebar-ticker">{e.tickers[0]}</span>}
                    <span className="sidebar-text">{e.text}</span>
                    {e.source === 'telegram' && <Send size={13} className="sidebar-mark" aria-label={t('Dari Telegram')} />}
                    {ACTIVE.has(e.status) && <LoaderCircle size={14} className="spin sidebar-mark" aria-label={t('Sedang diperiksa')} />}
                    {e.status === 'FAILED' && <AlertCircle size={14} className="sidebar-mark" aria-label={t('Terhenti')} />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {entries && entries.length > 0 && <Link href="/history" className="sidebar-all">{t('Lihat semua riwayat')}</Link>}
        <Link href="/integrations" className="sidebar-integrations" aria-current={pathname === '/integrations' ? 'page' : undefined}><Plug size={15} aria-hidden="true" />{t('Integrasi')}</Link>
      </div>
      <AccountMenu />
    </nav>
  );
}

function AccountMenu() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  if (!user) return null;
  const themes = [
    { value: 'dark', label: 'Gelap', Icon: Moon },
    { value: 'light', label: 'Terang', Icon: Sun },
    { value: 'system', label: 'Ikuti sistem', Icon: Monitor },
  ] as const;

  return (
    <div className="account" ref={box}>
      {open && (
        <div className="account-menu" role="group" aria-label={t('Pengaturan akun')}>
          <p className="account-email" title={user.email}>{user.email}</p>
          <Link href="/integrations" className="account-link" onClick={() => setOpen(false)}><Plug size={15} aria-hidden="true" />{t('Integrasi')}</Link>
          <span className="account-label">{t('Tema tampilan')}</span>
          <div className="segmented">
            {themes.map(({ value, label, Icon }) => (
              <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)} title={t(label)}>
                <Icon size={15} aria-hidden="true" /><span>{t(label)}</span>
              </button>
            ))}
          </div>
          <span className="account-label">{t('Bahasa tampilan')}</span>
          <div className="segmented">
            {(['id', 'en'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)}>
                {language === value && <Check size={14} aria-hidden="true" />}{value === 'id' ? 'Bahasa Indonesia' : 'English'}
              </button>
            ))}
          </div>
          <button type="button" className="account-signout" onClick={async () => {
            setError('');
            try { await signOut(); router.push('/'); } catch { setError(t('Keluar gagal. Coba lagi.')); }
          }}><LogOut size={16} aria-hidden="true" />{t('Keluar')}</button>
          {error && <p className="small" role="alert">{error}</p>}
        </div>
      )}
      <button ref={toggle} type="button" className="account-button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="account-name">{user.name}</span>
      </button>
    </div>
  );
}
