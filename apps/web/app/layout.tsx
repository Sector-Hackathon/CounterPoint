import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Counterpoint',
  description: 'Test the evidence behind Indonesian stock theses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
