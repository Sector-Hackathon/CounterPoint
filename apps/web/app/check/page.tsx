'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Composer } from '@/components/Composer';
import { useLanguage } from '@/components/LanguageProvider';

const EXAMPLES = {
  id: [
    'TLKM dividennya tinggi dan growth kuat, valuasinya juga murah dibanding emiten telco lain.',
    'BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.',
    'BBCA growth kuat dan dividennya stabil, layak dikoleksi.',
  ],
  en: [
    'TLKM pays a high dividend and growth is strong; its valuation is also cheap versus other telcos.',
    'BBRI looks attractive because growth is strong and its valuation is cheap compared with other large banks. Its price will rise to 6000.',
    'BBCA growth is strong and its dividend is stable, worth accumulating.',
  ],
};

export default function Start() {
  const { language, t } = useLanguage();
  const [prefill, setPrefill] = useState<{ text: string; nonce: number }>();

  return (
    <main id="main-content" className="start">
      <div className="start-brand"><Image className="brand-logo" src="/brand/counterpoint-logo-concept.png" alt="Counterpoint" width={2172} height={724} priority /></div>
      <p className="start-lead">{t('Tempel pesan saham. Counterpoint memeriksa setiap klaim dengan data Sectors dan mencari bukti yang melemahkannya.')}</p>
      <Composer prefill={prefill} autoFocus />
      <div className="examples" role="group" aria-label={t('Contoh pesan')}>
        {EXAMPLES[language].map((example) => (
          <button key={example} type="button" onClick={() => setPrefill({ text: example, nonce: Date.now() })}>
            <span>{example}</span>
          </button>
        ))}
      </div>
      <p className="start-foot">{t('Informasi dan analisis saja. Counterpoint tidak memberikan rekomendasi beli, jual, atau tahan saham.')}</p>
    </main>
  );
}
