'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, CircleHelp, ExternalLink } from 'lucide-react';
import type { ClaimReport } from '@/lib/api';
import { buildClaimAnalytics, type MetricTile } from '@/lib/claim-analytics';
import { conditionText, formatValue, metricLabel } from '@/lib/format';
import { assessmentText } from '@/lib/report-summary';
import { coverageLabel } from '@/lib/display-copy';
import type { ClaimState } from '@/lib/session-state';
import { useLanguage } from './LanguageProvider';
import { ReasoningThread } from './ReasoningThread';
import { Status } from './Status';
import { VerdictCard } from './VerdictCard';

const OUTCOME: Record<string, string> = { supports: 'Mendukung', weakens: 'Melemahkan', neutral: 'Netral' };
const ANSWER: Record<string, string> = { yes: 'Ya', no: 'Tidak', untested: 'Tak teruji', pending: 'Menunggu' };

/**
 * One claim as an analytics view: verdict, key numbers on threshold scales, the counter-case as a
 * yes/no checklist, the single condition that would change the verdict, and the agent's steps as a
 * timeline. Sentences live behind toggles; numbers come first.
 */
export function ClaimAnalytics({ claim, report, terminal, onOpen }: {
  claim: ClaimState;
  report: ClaimReport | null;
  terminal: boolean;
  onOpen: (evidenceId: string) => void;
}) {
  const { language, t } = useLanguage();
  const a = useMemo(() => buildClaimAnalytics(claim, report), [claim, report]);
  const [showSteps, setShowSteps] = useState(false);
  const assessment = report?.assessment ?? (claim.verifiability === 'NO' ? 'UNVERIFIABLE' : claim.assessment);
  const coverage = report?.coverage ?? claim.coverage;
  const canOpen = Boolean(report);

  if (claim.verifiability === 'NO') {
    return (
      <section className="analytics" aria-labelledby={`an-${claim.id}`}>
        <header className="an-head"><h2 id={`an-${claim.id}`}>“{claim.originalText}”</h2><Status value="UNVERIFIABLE" /></header>
        <p className="an-scope">{claim.scopeNote ? t(claim.scopeNote) : t('Klaim ini tidak dapat diuji dengan data yang tersedia.')}</p>
      </section>
    );
  }

  return (
    <section className="analytics" aria-labelledby={`an-${claim.id}`}>
      <header className="an-head">
        <h2 id={`an-${claim.id}`}>“{claim.originalText}”</h2>
        <Status value={assessment} />
      </header>

      <div className="an-grid">
        <div className="an-panel an-verdict">
          <span className="an-label">{t('Hasil')}</span>
          <strong className="an-verdict-text" data-s={assessment ?? 'PENDING'}>{assessmentText(assessment ?? 'PENDING', language)}</strong>
          <ul className="an-tally" aria-label={t('Ringkasan bukti')}>
            <li data-o="supports"><b className="tabular">{a.tally.supports}</b>{t('mendukung')}</li>
            <li data-o="weakens"><b className="tabular">{a.tally.weakens}</b>{t('melemahkan')}</li>
            <li data-o="neutral"><b className="tabular">{a.tally.neutral}</b>{t('netral')}</li>
          </ul>
          {coverage && (
            <div className="an-coverage">
              <div className="an-meter" role="img" aria-label={coverageLabel(coverage, language)}>
                {Array.from({ length: coverage.required }, (_, i) => <span key={i} data-on={i < coverage.completed} />)}
              </div>
              <span className="small muted">{coverageLabel(coverage, language)}</span>
            </div>
          )}
          {report?.interpretation && (
            <details className="an-explain">
              <summary>{t('Penjelasan')}</summary>
              <p>{report.interpretation.text}</p>
            </details>
          )}
        </div>

        <div className="an-panel an-metrics">
          <span className="an-label">{t('Angka utama')}</span>
          {a.metrics.length === 0 && <p className="small muted">{t('Bukti sedang dikumpulkan untuk klaim ini.')}</p>}
          {a.metrics.map((m) => <Metric key={m.checkId} m={m} canOpen={canOpen} onOpen={onOpen} />)}
        </div>

        <div className="an-panel an-counter">
          <span className="an-label voice-counter">{t('Alasan tandingan')}</span>
          {claim.direction === 'bearish' ? (
            <p className="small muted">{t('Klaim ini menyatakan kelemahan. Bukti kekuatan yang dapat menyanggahnya ditampilkan pada angka utama.')}</p>
          ) : a.counter.length === 0 ? (
            <p className="small muted">{t('Alasan tandingan diuji setelah pemeriksaan dasar klaim selesai.')}</p>
          ) : (
            <ul className="an-checklist">
              {a.counter.map((c) => (
                <li key={c.checkId}>
                  <span className="an-question">{t(c.question)}</span>
                  <span className="an-answer" data-a={c.answer}>{t(ANSWER[c.answer]!)}</span>
                  {c.metric && c.metric.value !== null && <span className="an-qmetric tabular">{metricLabel(c.metric.metric, language)} {formatValue(c.metric.value, c.metric.unit)}</span>}
                  {c.answer === 'untested' && c.note && <span className="an-qmetric">{t(c.note)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {a.change && a.change.effect !== 'missing_evidence' && (
        <div className="an-change">
          <span className="an-label">{t('Hasil berubah jika')}</span>
          <span className="an-change-text">{conditionText(a.change, language)}</span>
          {a.change.wouldBecome && <span className="an-arrow">→ <Status value={a.change.wouldBecome} /></span>}
          {canOpen && a.change.evidenceId && <button type="button" className="an-link" onClick={() => onOpen(a.change!.evidenceId!)}><ExternalLink size={13} aria-hidden="true" />{t('Sumber')}</button>}
        </div>
      )}

      <div className="an-timeline">
        <span className="an-label">{t('Agent')}</span>
        <ol className="an-dots" aria-label={t('Langkah pemeriksaan')}>
          {a.timeline.map((p) => <li key={p.id} data-kind={p.kind} data-o={p.outcome ?? 'none'} title={p.label ? t(p.label) : undefined} />)}
          {!terminal && claim.assessment === null && <li className="an-dot-live" aria-label={t('Sedang diperiksa')} />}
        </ol>
        <span className="small muted tabular">{t('{count} langkah', { count: a.timeline.length })}</span>
        <button type="button" className="an-link" aria-expanded={showSteps} onClick={() => setShowSteps((v) => !v)}>
          {t(showSteps ? 'Sembunyikan langkah' : 'Lihat langkah')}<ChevronDown size={14} aria-hidden="true" style={{ transform: showSteps ? 'rotate(180deg)' : undefined }} />
        </button>
      </div>
      {showSteps && <div className="an-steps"><ReasoningThread steps={claim.steps} terminal={terminal} /></div>}

      {report && (
        <details className="an-full">
          <summary>{t('Detail lengkap & sumber')}</summary>
          <VerdictCard quote={claim.originalText} report={report} onOpen={onOpen} />
        </details>
      )}
    </section>
  );
}

function Metric({ m, canOpen, onOpen }: { m: MetricTile; canOpen: boolean; onOpen: (id: string) => void }) {
  const { language, t } = useLanguage();
  const body = (
    <>
      <span className="an-mlabel">{metricLabel(m.metric, language)}</span>
      <span className="an-mvalue tabular">{formatValue(m.value, m.unit)}</span>
      {m.outcome && <span className="an-pill" data-o={m.outcome}>{t(OUTCOME[m.outcome]!)}</span>}
      {m.scale && (
        <span className="an-scale" aria-hidden="true">
          <span className="an-track" />
          <span className="an-threshold" style={{ left: `${m.scale.thresholdPct}%` }} />
          <span className="an-marker" data-o={m.outcome ?? 'none'} style={{ left: `${m.scale.valuePct}%` }} />
        </span>
      )}
      <span className="an-mmeta">
        {[m.period, m.comparisonPeriod && `vs ${m.comparisonPeriod}`].filter(Boolean).join(' ')}
        {m.threshold !== null && <> · {t('batas')} {formatValue(m.threshold, m.unit)}</>}
        {m.rule && <span className="an-rule" title={t(m.rule)}><CircleHelp size={12} aria-label={t(m.rule)} /></span>}
      </span>
    </>
  );
  return canOpen
    ? <button type="button" className="an-metric" onClick={() => onOpen(m.evidenceId)} title={t('Lihat sumber')}>{body}</button>
    : <div className="an-metric">{body}</div>;
}
