'use client';
import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
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

function FlagIndonesia() {
  return <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="1" fill="#ce1126" /><rect y="1" width="3" height="1" fill="#fff" /></svg>;
}

function FlagUnitedKingdom() {
  const clip = useId();
  return <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
    <clipPath id={clip}><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
    <rect width="60" height="30" fill="#012169" />
    <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
    <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${clip})`} stroke="#c8102e" strokeWidth="4" />
    <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
    <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
  </svg>;
}

const LANGUAGE_FLAGS = [
  { value: 'id', label: 'Bahasa Indonesia', Flag: FlagIndonesia },
  { value: 'en', label: 'English', Flag: FlagUnitedKingdom },
] as const;

/** The display language as two flags; the pressed one is the language in use. */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-flags" role="group" aria-label={t('Bahasa tampilan')}>
    {LANGUAGE_FLAGS.map(({ value, label, Flag }) => <button key={value} type="button" lang={value} aria-pressed={language === value} aria-label={label} title={label} onClick={() => setLanguage(value)}>
      <span className="language-flag" aria-hidden="true"><Flag /></span>
    </button>)}
  </div>;
}
