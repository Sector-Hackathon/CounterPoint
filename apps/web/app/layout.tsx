import type { Metadata } from 'next';
import { IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { LanguageProvider, LanguageSwitcher } from '@/components/LanguageProvider';

const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const display = Schibsted_Grotesk({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Counterpoint',
  description: 'Paste an Indonesian stock thesis. Counterpoint tests each claim against Sectors data and builds the strongest case against it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${body.variable} ${display.variable}`}>
      <body><LanguageProvider><LanguageSwitcher />{children}</LanguageProvider></body>
    </html>
  );
}
