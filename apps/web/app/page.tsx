import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Counterpoint — Cek klaim sebelum ikut FOMO',
  description: 'Periksa ajakan saham dari pesan atau screenshot. Counterpoint menguji bukti pendukung dan pelemah, serta menunjukkan keterbatasan data.',
};

export default function Home() {
  return <LandingPage />;
}
