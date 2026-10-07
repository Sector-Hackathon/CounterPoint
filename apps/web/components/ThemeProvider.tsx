'use client';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'counterpoint.theme';
/** No saved choice means dark, the workspace default; 'system' is an explicit choice. */
const parseTheme = (value: string | null): Theme => value === 'light' || value === 'system' ? value : 'dark';
const resolve = (theme: Theme): 'light' | 'dark' =>
  theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
const applyTheme = (theme: Theme) => { document.documentElement.dataset.theme = resolve(theme); };
const ThemeContext = createContext({ theme: 'dark' as Theme, setTheme: (_theme: Theme) => {} });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  useEffect(() => {
    let saved: Theme = 'system';
    try { saved = parseTheme(localStorage.getItem(STORAGE_KEY)); } catch { /* Storage is optional. */ }
    setThemeState(saved);
    applyTheme(saved);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = parseTheme(event.newValue);
      setThemeState(next); applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onSystem = () => { if (parseTheme(localStorage.getItem(STORAGE_KEY)) === 'system') applyTheme('system'); };
    media.addEventListener('change', onSystem);
    return () => { window.removeEventListener('storage', onStorage); media.removeEventListener('change', onSystem); };
  }, []);
  const setTheme = (next: Theme) => {
    setThemeState(next); applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep this session's selection. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const CurrentIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return <div ref={container} className="theme-control">
    <button ref={toggle} type="button" className="theme-toggle quiet" aria-expanded={open} aria-controls={panelId} aria-label={t('Pilih tema tampilan')} title={t('Pilih tema tampilan')} onClick={() => setOpen((value) => !value)}><CurrentIcon size={18} aria-hidden="true" /></button>
    {open && <div id={panelId} className="theme-popover" role="group" aria-label={t('Tema tampilan')}>
      <span className="small muted">{t('Tema tampilan')}</span>
      {([{ value: 'light', label: 'Terang', Icon: Sun }, { value: 'dark', label: 'Gelap', Icon: Moon }, { value: 'system', label: 'Ikuti sistem', Icon: Monitor }] as const).map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => { setTheme(value); setOpen(false); toggle.current?.focus(); }}><Icon size={16} aria-hidden="true" /><span>{t(label)}</span>{theme === value && <Check size={15} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
