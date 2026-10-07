'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, type PublicUser } from '@/lib/api';
import { useLanguage } from './LanguageProvider';

type AuthState = 'loading' | 'ready' | 'error';
const Context = createContext<{ user: PublicUser | null; status: AuthState; refresh: () => Promise<void>; acceptUser: (user: PublicUser) => void; signOut: () => Promise<void> } | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthState>('loading');
  const refresh = useCallback(async () => {
    setStatus('loading');
    try { const result = await api.me(); setUser(result.user); setStatus('ready'); }
    catch { setStatus('error'); }
  }, []);
  useEffect(() => {
    void refresh();
    const expired = () => { setUser(null); setStatus('ready'); };
    window.addEventListener('counterpoint.auth-required', expired);
    return () => window.removeEventListener('counterpoint.auth-required', expired);
  }, [refresh]);
  const acceptUser = (value: PublicUser) => { setUser(value); setStatus('ready'); };
  const signOut = async () => { await api.signOut(); setUser(null); setStatus('ready'); };
  return <Context.Provider value={{ user, status, refresh, acceptUser, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider missing'); return value; }
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, status, refresh } = useAuth();
  const pathname = usePathname(); const router = useRouter(); const { t } = useLanguage();
  useEffect(() => { if (status === 'ready' && !user) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`); }, [status, user, pathname, router]);
  if (status === 'error') return <main id="main-content" className="page"><div className="sheet auth-loading"><p role="alert">{t('Tidak dapat terhubung ke server. Coba lagi.')}</p><button className="primary" onClick={() => void refresh()}>{t('Coba lagi')}</button></div></main>;
  if (status !== 'ready' || !user) return <main id="main-content" className="page"><p role="status">{t('Memuat akun…')}</p></main>;
  return children;
}
