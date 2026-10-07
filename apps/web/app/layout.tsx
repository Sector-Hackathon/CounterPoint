import type { Metadata } from 'next';
import { IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { AppHeader } from '@/components/AppHeader';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { cookies } from 'next/headers';
import { parseLanguage } from '@/lib/locale';

const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const display = Schibsted_Grotesk({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Counterpoint',
  description: 'Paste an Indonesian stock thesis. Counterpoint tests each claim against Sectors data and builds the strongest case against it.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const savedLanguage = (await cookies()).get('counterpoint.language')?.value;
  const language = parseLanguage(savedLanguage ?? null);
  return (
    <html lang={language} suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: "try{const t=localStorage.getItem('counterpoint.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch{}" }} /></head>
      <body><LanguageProvider initialLanguage={savedLanguage ? language : undefined}><ThemeProvider><AuthProvider><AppHeader />{children}</AuthProvider></ThemeProvider></LanguageProvider></body>
    </html>
  );
}
