'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { wrapFocus } from '@/lib/session-logic';
import type { EvidenceItem } from '@/lib/api';
import { formatValue, metricLabel } from '@/lib/format';

export function EvidenceDrawer({ item, all, onClose }: { item: EvidenceItem | null; all: EvidenceItem[]; onClose: () => void }) {
  const { language, t } = useLanguage();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const open = item !== null;

  // Focus moves into the dialog on open and back to the control that opened it on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')];
      const next = wrapFocus(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, e.shiftKey);
      if (next >= 0) {
        e.preventDefault();
        focusable[next]!.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const inputs = item ? item.derivedFrom.map((id) => all.find((e) => e.id === id)).filter((e): e is EvidenceItem => !!e) : [];

  return (
    <AnimatePresence>
      {item && (
        <motion.aside
          ref={panelRef}
          role="dialog" aria-modal="true" aria-labelledby="ev-title" className="drawer"
          initial={reduce ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduce ? undefined : { x: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <button ref={closeRef} className="quiet" onClick={onClose} style={{ float: 'right' }}>{t('Tutup')}</button>
          <h2 id="ev-title">{metricLabel(item.metric, language)}</h2>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>{formatValue(item.value, item.unit)}</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
            <dt className="muted">{t('Periode')}</dt><dd style={{ margin: 0 }}>{item.economicPeriod ?? item.observationDate ?? 'n/a'}{item.comparisonPeriod ? ` vs ${item.comparisonPeriod}` : ''}</dd>
            <dt className="muted">{t('Sumber')}</dt><dd style={{ margin: 0, wordBreak: 'break-all' }}>{item.sourceLocator}</dd>
            <dt className="muted">{t('Data diambil')}</dt><dd style={{ margin: 0 }}>{new Date(item.retrievalTime).toLocaleString(language === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta' }) + ' WIB'}</dd>
            <dt className="muted">{t('Perhitungan')}</dt><dd style={{ margin: 0 }}>{item.calculationVersion ?? t('nilai dari sumber')}</dd>
            {item.note && (<><dt className="muted">{t('Catatan')}</dt><dd style={{ margin: 0 }}>{item.note}</dd></>)}
          </dl>
          {inputs.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>{t('Dihitung dari')}</h3>
              <ul style={{ paddingLeft: 18 }}>
                {inputs.map((e) => <li key={e.id}>{metricLabel(e.metric, language)}: {formatValue(e.value, e.unit)} ({e.economicPeriod ?? e.observationDate})</li>)}
              </ul>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
