import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex' });

export const metadata: Metadata = {
  title: 'Counterpoint: evidence checks for stock theses',
  description: 'Paste an Indonesian stock thesis. Counterpoint splits it into claims, checks each against Sectors data, and shows what the evidence supports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>{children}</body>
    </html>
  );
}
