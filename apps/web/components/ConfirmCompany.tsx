'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { useEffect, useState } from 'react';
import { api, type EntityView } from '@/lib/api';

/** Shown when a mention matches several companies: the investigation waits for the user instead of guessing. */
export function ConfirmCompany({ sessionId }: { sessionId: string }) {
  const { t } = useLanguage();
  const [entities, setEntities] = useState<EntityView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSession(sessionId).then((s) => setEntities(s.entities)).catch((e: Error) => setError(e.message));
  }, [sessionId]);

  const ambiguous = entities.filter((e) => e.resolutionStatus === 'AMBIGUOUS');
  const unknownOnly = entities.length > 0 && entities.every((e) => e.resolutionStatus === 'UNKNOWN');

  return (
    <section className="sheet" style={{ display: 'grid', gap: 16, marginTop: 32, maxWidth: 640 }} aria-live="polite">
      <h2>{t('Perusahaan mana yang dimaksud?')}</h2>
      {unknownOnly && <p>{t('Perusahaan dalam pesan belum ditemukan di data Sectors. Periksa ticker lalu coba lagi.')}</p>}
      {ambiguous.map((e) => (
        <EntityChoice key={e.id} sessionId={sessionId} entity={e} onError={setError} />
      ))}
      {error && <p role="alert" style={{ color: 'var(--resolve)' }}>{error}</p>}
    </section>
  );
}

function EntityChoice({ sessionId, entity, onError }: { sessionId: string; entity: EntityView; onError: (m: string) => void }) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState(entity.candidates[0]?.ticker ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label htmlFor={`e-${entity.id}`}>“{entity.mention}” {t('cocok dengan beberapa perusahaan.')}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          id={`e-${entity.id}`}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          style={{ font: 'inherit', padding: '10px 12px', borderRadius: 'var(--r-chip)', border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)' }}
        >
          {entity.candidates.map((c) => (
            <option key={c.ticker} value={c.ticker}>
              {c.ticker}: {c.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !choice}
          onClick={async () => {
            setBusy(true);
            try {
              await api.confirmEntity(sessionId, entity.id, choice);
            } catch (e) {
              onError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? t('Mengonfirmasi…') : t('Konfirmasi perusahaan')}
        </button>
      </div>
    </div>
  );
}
