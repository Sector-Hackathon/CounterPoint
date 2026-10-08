'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, LoaderCircle, MessageCircle, Send } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { api, type IntegrationsView } from '@/lib/api';
import { countdown, telegramCard } from '@/lib/integrations';

export default function IntegrationsPage() {
  const { language, t } = useLanguage();
  const [view, setView] = useState<IntegrationsView | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ url: string; expiresAt: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setView(await api.getIntegrations(signal));
      setError('');
    } catch {
      if (!signal?.aborted) setError('Integrasi belum dapat dimuat. Coba lagi.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const card = view ? telegramCard(view.telegram, pending, now) : null;
  const waiting = card?.kind === 'waiting';

  // While a code is pending: tick the countdown every second and check for the link every 3 seconds.
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void load(), 3000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [waiting, load]);

  useEffect(() => {
    if (card?.kind === 'linked' && pending) { setPending(null); setQr(null); }
  }, [card?.kind, pending]);

  useEffect(() => {
    if (!pending) return;
    let live = true;
    QRCode.toDataURL(pending.url, { margin: 1, width: 192 }).then((url) => { if (live) setQr(url); }).catch(() => { if (live) setQr(null); });
    return () => { live = false; };
  }, [pending]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const next = await api.linkTelegram();
      setPending(next);
      setNow(Date.now());
      window.open(next.url, '_blank', 'noopener');
    } catch {
      setError('Kode belum dapat dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      await api.unlinkTelegram();
      setConfirmUnlink(false);
      await load();
    } catch {
      setError('Gagal memutuskan Telegram. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (iso: string) => new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <main id="main-content" className="page integrations-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">{t('Integrasi')}</span>
          <h1>{t('Periksa klaim dari aplikasi chat')}</h1>
          <p>{t('Hubungkan akunmu sekali, lalu kirim pesan saham dari chat. Hasilnya tersimpan di riwayatmu.')}</p>
        </div>
      </header>
      {error && <p className="notice" role="alert">{t(error)}</p>}
      <div className="integrations-grid">
        <section className="sheet integration-card" aria-labelledby="tg-title">
          <div className="integration-head">
            <span className="integration-icon" aria-hidden="true"><Send size={20} /></span>
            <div>
              <h2 id="tg-title">Telegram</h2>
              <p className="small muted">{t('Kirim teks atau screenshot ke bot. Hasilnya dikirim balik dengan tautan ke analisis lengkap.')}</p>
            </div>
          </div>
          {!card && !error && <p className="small muted" role="status"><LoaderCircle size={14} className="spin" aria-hidden="true" /> {t('Memuat integrasi…')}</p>}
          {card?.kind === 'unavailable' && <button type="button" className="button" disabled>{t('Belum tersedia')}</button>}
          {card?.kind === 'idle' && <button type="button" className="button primary" disabled={busy} onClick={() => void connect()}>{t('Hubungkan Telegram')}</button>}
          {card?.kind === 'expired' && (
            <div className="integration-row">
              <p className="small muted">{t('Kode sudah kedaluwarsa.')}</p>
              <button type="button" className="button primary" disabled={busy} onClick={() => void connect()}>{t('Buat kode baru')}</button>
            </div>
          )}
          {card?.kind === 'waiting' && (
            <div className="integration-waiting">
              {qr && <img src={qr} width={192} height={192} alt={t('Kode QR untuk membuka bot Telegram')} className="integration-qr" />}
              <div>
                <p role="status"><LoaderCircle size={15} className="spin" aria-hidden="true" /> {t('Menunggu konfirmasi di Telegram…')}</p>
                <p className="small muted">{t('Tekan Start di Telegram, atau pindai kode QR dengan HP. Berlaku {time}.', { time: countdown(card.secondsLeft) })}</p>
                <a className="button primary" href={card.url} target="_blank" rel="noopener noreferrer">{t('Buka Telegram')}<ExternalLink size={15} aria-hidden="true" /></a>
              </div>
            </div>
          )}
          {card?.kind === 'linked' && (
            <div className="integration-row">
              <p>{t('Terhubung sebagai {name} · sejak {date}', { name: card.username ? `@${card.username}` : 'Telegram', date: formatDate(card.linkedAt) })}</p>
              <div className="integration-actions">
                {view?.telegram.botUsername && <a className="button primary" href={`https://t.me/${view.telegram.botUsername}`} target="_blank" rel="noopener noreferrer">{t('Buka bot')}<ExternalLink size={15} aria-hidden="true" /></a>}
                {confirmUnlink ? (
                  <>
                    <span className="small">{t('Putuskan Telegram dari akunmu?')}</span>
                    <button type="button" className="button quiet" disabled={busy} onClick={() => void disconnect()}>{t('Ya, putuskan')}</button>
                    <button type="button" className="button quiet" onClick={() => setConfirmUnlink(false)}>{t('Batal')}</button>
                  </>
                ) : (
                  <button type="button" className="button quiet" onClick={() => setConfirmUnlink(true)}>{t('Putuskan')}</button>
                )}
              </div>
            </div>
          )}
        </section>
        <section className="sheet integration-card is-soon" aria-labelledby="dc-title">
          <div className="integration-head">
            <span className="integration-icon" aria-hidden="true"><MessageCircle size={20} /></span>
            <div>
              <h2 id="dc-title">Discord</h2>
              <p className="small muted">{t('Periksa klaim langsung dari server Discord komunitas sahammu.')}</p>
            </div>
          </div>
          <button type="button" className="button" disabled>{t('Segera hadir')}</button>
        </section>
      </div>
    </main>
  );
}
