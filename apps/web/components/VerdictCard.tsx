'use client';
import { useLanguage } from '@/components/LanguageProvider';
import { motion, useReducedMotion } from 'motion/react';
import type { ClaimReport, CounterpointHypothesis, Statement } from '@/lib/api';
import { ChangeConditions } from './ChangeConditions';
import { Status } from './Status';
import { coverageLabel } from '@/lib/display-copy';

function Statements({ items, onOpen }: { items: Statement[]; onOpen: (id: string) => void }) {
  const { t } = useLanguage();
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
      {items.map((s, i) => (
        <li key={i}>
          {t(s.text)}{' '}
          {s.evidenceIds[0] && <button className="quiet small" style={{ padding: '2px 8px' }} onClick={() => onOpen(s.evidenceIds[0]!)}>{t('Lihat sumber')}</button>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Why a counter-question has the answer it does. A question the evidence never raised is
 * reported as exactly that, and never as one the agent ran out of budget for.
 */
function hypothesisResult(h: CounterpointHypothesis, t: ReturnType<typeof useLanguage>['t']): string {
  switch (h.status) {
    case 'confirmed':
      return t('Ya, data mendukung alasan tandingan ini.');
    case 'refuted':
      return t('Data tidak mendukung alasan tandingan ini.');
    case 'untestable':
      return `${t('Belum dapat diuji')}: ${t(h.note ?? 'data tidak tersedia')}.`;
    case 'not_applicable':
      return t('Tidak diuji karena klaim sudah gagal pada pemeriksaan dasarnya.');
    default:
      return t('Belum diuji karena batas pemeriksaan.');
  }
}

/** The report's moment: thesis and counterpoint lanes slide together around the verdict. */
export function VerdictCard({ quote, report, onOpen, children }: { quote: string; report: ClaimReport; onOpen: (evidenceId: string) => void; children?: React.ReactNode }) {
  const { language, t } = useLanguage();
  const reduce = useReducedMotion();
  const counter = report.counterpoint?.hypotheses ?? [];
  const lane = (from: number) => (reduce ? {} : { initial: { x: from, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } });
  return (
    <article id={`claim-${report.claimId}`} className="sheet" style={{ display: 'grid', gap: 24, scrollMarginTop: 24 }}>
      <header className="verdict-header">
        <div className="verdict-title">
        <h2>“{quote}”</h2>
        <Status value={report.assessment} />
        </div>
        <span className="small muted">{coverageLabel(report.coverage, language)}</span>
      </header>
      <div className="evidence-columns">
        <motion.section className="evidence-panel" {...lane(-24)}>
          <div className="lane-title voice-thesis">{t('Bukti pendukung')}</div>
          {report.supports.length ? <Statements items={report.supports} onOpen={onOpen} /> : <p className="muted">{t('Belum ada bukti pendukung dari pemeriksaan ini.')}</p>}
          {report.context.length > 0 && (<><div className="lane-title" style={{ marginTop: 16 }}>{t('Konteks')}</div><Statements items={report.context} onOpen={onOpen} /></>)}
        </motion.section>
        <motion.section className="evidence-panel" data-voice="counter" {...lane(24)}>
          <div className="lane-title voice-counter">{t('Bukti yang melemahkan')}</div>
          {report.weakens.length > 0 && <Statements items={report.weakens} onOpen={onOpen} />}
          {counter.length > 0 && (
            <ul style={{ margin: report.weakens.length ? '12px 0 0' : 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
              {counter.map((h) => (
                <li key={h.checkId}>
                  <strong>{t(h.hypothesis)}</strong> <span className="small">{hypothesisResult(h, t)}</span>
                  {h.statement && <div className="small muted">{t(h.statement.text)}</div>}
                </li>
              ))}
            </ul>
          )}
          {!report.weakens.length && !counter.length && <p className="muted">{t('Belum ditemukan bukti pelemah pada pemeriksaan yang dijalankan.')}</p>}
        </motion.section>
      </div>
      <ChangeConditions items={report.changeConditions} onOpen={onOpen} />
      {(report.missing.length > 0 || (report.counterpoint?.openQuestions.length ?? 0) > 0) && (
        <div style={{ background: 'var(--hatch), var(--paper)', borderRadius: 'var(--r-chip)', padding: 16 }}>
          <div className="lane-title">{t('Data yang belum tersedia dan batasan')}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {report.missing.map((m, i) => <li key={`m${i}`}>{t(m)}</li>)}
            {report.counterpoint?.openQuestions.map((q, i) => <li key={`q${i}`}>{t(q)}</li>)}
          </ul>
        </div>
      )}
      {report.interpretation && <p style={{ margin: 0 }}>{report.interpretation.text}</p>}
      {report.peerSet && (
        <details>
          <summary>{t('Perusahaan pembanding')} ({t('{count} perusahaan', { count: report.peerSet.included.length })}, {report.peerSet.period})</summary>
          <p className="small" >{t('Digunakan')}: {report.peerSet.included.join(', ')}</p>
          <ul className="small">{report.peerSet.excluded.map((e) => <li key={e.ticker}>{e.ticker}: {t(e.reason)}</li>)}</ul>
        </details>
      )}
      {children}
    </article>
  );
}
