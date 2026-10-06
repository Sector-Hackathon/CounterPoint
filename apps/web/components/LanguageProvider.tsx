'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_STORAGE_KEY, parseLanguage, translate, type Language } from '@/lib/locale';

const LanguageContext = createContext({
  language: 'id' as Language,
  setLanguage: (_language: Language) => {},
  t: (message: string, values?: Record<string, string | number>) => translate('id', message, values),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');
  useEffect(() => {
    try { setLanguageState(parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage: (next: Language) => {
      setLanguageState(next);
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Keep the selection for this session. */ }
    },
    t: (message: string, values?: Record<string, string | number>) => translate(language, message, values),
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-control">
    <label>
      <span className="visually-hidden">{t('Bahasa tampilan')}</span>
      <select value={language} onChange={(e) => setLanguage(parseLanguage(e.target.value))}>
        <option value="id">ID · Indonesia</option>
        <option value="en">EN · English</option>
      </select>
    </label>
  </div>;
}
