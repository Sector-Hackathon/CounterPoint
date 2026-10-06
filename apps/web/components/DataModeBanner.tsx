'use client';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * States plainly which evidence the session is built on. A viewer must never have to guess
 * whether a number came from Sectors or from the synthetic development fixture, so both modes
 * are announced, not just the synthetic one. Every evidence item's source locator
 * (`sectors:` / `fixture:`) says the same thing again in the evidence drawer.
 */
export function DataModeBanner({ mode }: { mode: 'live' | 'fixture' | null }) {
  const { t } = useLanguage();
  if (mode === null) return null;
  const fixture = mode === 'fixture';
  return (
    <p className="data-mode" data-mode={mode} role="note">
      <strong>{fixture ? t('Data sintetis untuk demo') : t('Data dari Sectors API')}</strong>
      {fixture
        ? t(' — angka ilustrasi untuk pengembangan, bukan data keuangan perusahaan asli dan bukan dari Sectors.')
        : t(' — angka untuk sesi ini diambil dari Sectors API. Periode dan waktu pengambilannya tersedia pada sumber bukti.')}
    </p>
  );
}
