'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'counterpoint.theme';
const parseTheme = (value: string | null): Theme => value === 'light' || value === 'dark' ? value : 'system';
const applyTheme = (theme: Theme) => {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
};
const ThemeContext = createContext({ theme: 'system' as Theme, setTheme: (_theme: Theme) => {} });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
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
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const setTheme = (next: Theme) => {
    setThemeState(next); applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep this session's selection. */ }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/** Whether the operating system asks for dark mode, kept current while the page is open. */
function useSystemDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/**
 * One switch between light and dark. Until it is used, the page follows the system theme and the
 * switch shows whichever of the two that resolves to.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { t } = useLanguage();
  const systemDark = useSystemDark();
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  return <button type="button" role="switch" aria-checked={dark} className="theme-switch" aria-label={t('Mode gelap')} title={t('Mode gelap')} onClick={() => setTheme(dark ? 'light' : 'dark')}>
    <Sun className="theme-switch-sun" size={15} aria-hidden="true" />
    <Moon className="theme-switch-moon" size={15} aria-hidden="true" />
    <span className="theme-switch-knob" aria-hidden="true">{dark ? <Moon size={15} /> : <Sun size={15} />}</span>
  </button>;
}
