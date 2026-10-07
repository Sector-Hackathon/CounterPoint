import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './workspace.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { AppHeader } from '@/components/AppHeader';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { cookies } from 'next/headers';
import { parseLanguage } from '@/lib/locale';

// One sans for the whole workspace; headings differ by weight and size only.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Counterpoint',
  description: 'Paste an Indonesian stock thesis. Counterpoint tests each claim against Sectors data and builds the strongest case against it.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const savedLanguage = (await cookies()).get('counterpoint.language')?.value;
  const language = parseLanguage(savedLanguage ?? null);
  return (
    <html lang={language} suppressHydrationWarning className={inter.variable} data-theme="dark">
      <head><script dangerouslySetInnerHTML={{ __html: "try{const t=localStorage.getItem('counterpoint.theme');const r=t==='light'?'light':t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):'dark';document.documentElement.dataset.theme=r;}catch{}" }} /></head>
      <body><LanguageProvider initialLanguage={savedLanguage ? language : undefined}><ThemeProvider><AuthProvider><AppHeader />{children}</AuthProvider></ThemeProvider></LanguageProvider></body>
    </html>
  );
}
