'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_STORAGE_KEY, parseLanguage, translate, type Language } from '@/lib/locale';

const LanguageContext = createContext({
  language: 'id' as Language,
  setLanguage: (_language: Language) => {},
  t: (message: string, values?: Record<string, string | number>) => translate('id', message, values),
});

export function LanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? 'id');
  useEffect(() => {
    if (initialLanguage) return;
    try {
      const legacy = parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
      setLanguageState(legacy);
      document.cookie = `counterpoint.language=${legacy}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch { /* Storage is optional. */ }
  }, [initialLanguage]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage: (next: Language) => {
      setLanguageState(next);
      document.cookie = `counterpoint.language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
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
        <option value="id" aria-label="Bahasa Indonesia">ID</option>
        <option value="en" aria-label="English">EN</option>
      </select>
    </label>
  </div>;
}
