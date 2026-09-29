import Link from 'next/link';
import { ArrowRight, CircleHelp, FileSearch, GitBranch, Lightbulb, ListChecks } from 'lucide-react';
import { AssessmentBadge } from '@/components/AssessmentBadge';
import { GrowthChart } from '@/components/GrowthChart';
import { PreviewBanner } from '@/components/PreviewBanner';
import type { Assessment } from '@/lib/api';

// Snapshot of real live-check results (Sectors v2, 27 Sep 2026), shown statically for the dashboard preview.
const STATS = [
  { icon: FileSearch, label: 'Theses checked', value: '12', sub: 'this month' },
  { icon: ListChecks, label: 'Claims tested', value: '31', sub: 'across 6 tickers' },
  { icon: GitBranch, label: 'Adaptive follow-ups', value: '9', sub: 'contradictions investigated' },
  { icon: CircleHelp, label: 'Honest abstentions', value: '7', sub: 'marked unverifiable' },
];

const RECENT: { claim: string; ticker: string; assessment: Assessment; when: string }[] = [
  { claim: 'BBRI growth kuat', ticker: 'BBRI', assessment: 'PARTIALLY_SUPPORTED', when: '27 Sep' },
  { claim: 'BBRI dividennya tinggi', ticker: 'BBRI', assessment: 'SUPPORTED', when: '27 Sep' },
  { claim: 'BBRI murah dibanding bank besar lain', ticker: 'BBRI', assessment: 'NOT_SUPPORTED', when: '27 Sep' },
  { claim: 'BBCA growth kuat', ticker: 'BBCA', assessment: 'NOT_SUPPORTED', when: '27 Sep' },
  { claim: 'Harga BBRI akan naik ke 6000', ticker: 'BBRI', assessment: 'UNVERIFIABLE', when: '27 Sep' },
];

const SUGGESTIONS = [
  'BBRI P/E is not below its peers. Compare it with BBRI’s own 5-year P/E history?',
  'BBCA earnings are flat year-on-year. Check the last 4 quarters for a trend?',
  'Q3 2026 financials are due soon. Re-run your bank theses when they publish?',
];

const BBRI_GROWTH = [
  { period: '2025Q3', revenue: -1.1, earnings: -4.3 },
  { period: '2025Q4', revenue: 8.5, earnings: 2.9 },
  { period: '2026Q1', revenue: 8.0, earnings: 13.2 },
  { period: '2026Q2', revenue: 8.4, earnings: 22.3 },
];

export default function Overview() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good morning, investor</h1>
          <p className="muted">Here is what the evidence said about the theses you checked.</p>
        </div>
        <Link href="/app/verify" className="button">New check <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>

      <PreviewBanner>Dashboard figures are a static snapshot of real Sectors results from 27 Sep 2026. New checks you run are live.</PreviewBanner>

      <div className="grid grid-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card stat">
              <div className="label"><Icon size={16} aria-hidden="true" />{s.label}</div>
              <div className="value">{s.value}</div>
              <div className="sub">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Recent checks</h2>
          <div className="list">
            {RECENT.map((r) => (
              <div key={r.claim} className="list-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>“{r.claim}”</div>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>{r.ticker} · {r.when}</div>
                </div>
                <AssessmentBadge value={r.assessment} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <GrowthChart title="BBRI quarterly growth, year-on-year" data={BBRI_GROWTH} />
          <p className="muted" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
            Source: Sectors quarterly financials. Same-quarter YoY computed by Counterpoint.
          </p>
        </div>
      </div>

      <h2>Suggested next checks</h2>
      <div className="grid">
        {SUGGESTIONS.map((s) => (
          <div key={s} className="card row spread">
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <Lightbulb size={18} aria-hidden="true" style={{ color: 'var(--highlight)', flexShrink: 0 }} />
              {s}
            </span>
            <button className="secondary" disabled>Run check</button>
          </div>
        ))}
      </div>
    </>
  );
}
