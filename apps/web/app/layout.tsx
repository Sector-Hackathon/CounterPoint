import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Counterpoint',
  description: 'Test the evidence behind Indonesian stock theses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
