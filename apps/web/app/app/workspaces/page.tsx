'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';
import { AssessmentBadge } from '@/components/AssessmentBadge';
import { GrowthChart } from '@/components/GrowthChart';
import { PreviewBanner } from '@/components/PreviewBanner';
import type { Assessment } from '@/lib/api';

interface TrackedThesis {
  claim: string;
  ticker: string;
  assessment: Assessment;
  coverage: string;
  keyEvidence: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  theses: TrackedThesis[];
  suggestions: string[];
}

// Snapshot of real live-check results (Sectors v2, 27 Sep 2026). Static for the preview.
const WORKSPACES: Workspace[] = [
  {
    id: 'big-banks',
    name: 'Big banks — Q3 2026',
    description: 'Community theses about the largest Indonesian banks, checked against Sectors data.',
    theses: [
      { claim: 'BBRI growth kuat', ticker: 'BBRI', assessment: 'PARTIALLY_SUPPORTED', coverage: '3 of 3 required checks', keyEvidence: 'Net income +22.3% YoY (2026Q2 vs 2025Q2); FY2025 revenue −9.2%' },
      { claim: 'BBRI dividennya tinggi', ticker: 'BBRI', assessment: 'SUPPORTED', coverage: '3 of 3 required checks', keyEvidence: 'Trailing yield 11.0% vs 5-year average 6.8%' },
      { claim: 'BBRI murah dibanding bank besar lain', ticker: 'BBRI', assessment: 'NOT_SUPPORTED', coverage: '3 of 3 required checks', keyEvidence: 'P/E 7.58x is 0.5% above the 9-bank peer median' },
      { claim: 'BBCA growth kuat', ticker: 'BBCA', assessment: 'NOT_SUPPORTED', coverage: '3 of 3 required checks', keyEvidence: 'Net income −0.1% YoY (2026Q2 vs 2025Q2)' },
    ],
    suggestions: [
      'BBRI P/E is not below peers. Compare it with BBRI’s own 5-year P/E history?',
      'BBCA earnings are flat. Check the last 4 quarters for a trend?',
    ],
  },
  {
    id: 'dividend',
    name: 'Dividend ideas',
    description: 'Yield claims collected from Telegram groups.',
    theses: [],
    suggestions: ['Forward a thesis to the Counterpoint Telegram bot to add it here.'],
  },
];

const BBRI_GROWTH = [
  { period: '2025Q3', revenue: -1.1, earnings: -4.3 },
  { period: '2025Q4', revenue: 8.5, earnings: 2.9 },
  { period: '2026Q1', revenue: 8.0, earnings: 13.2 },
  { period: '2026Q2', revenue: 8.4, earnings: 22.3 },
];

export default function WorkspacesPage() {
  const [activeId, setActiveId] = useState(WORKSPACES[0]!.id);
  const active = WORKSPACES.find((w) => w.id === activeId)!;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workspaces</h1>
          <p className="muted">Group related theses, follow how the evidence changes, and act on suggested next checks.</p>
        </div>
        <button className="secondary" disabled><Plus size={18} aria-hidden="true" /> New workspace</button>
      </div>

      <PreviewBanner>Workspaces show a static snapshot of real Sectors results from 27 Sep 2026.</PreviewBanner>

      <div className="row" role="tablist" aria-label="Workspaces" style={{ marginBottom: 18 }}>
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            role="tab"
            aria-selected={w.id === activeId}
            className={w.id === activeId ? undefined : 'secondary'}
            onClick={() => setActiveId(w.id)}
          >
            {w.name} <span style={{ opacity: 0.7 }}>({w.theses.length})</span>
          </button>
        ))}
      </div>

      <p className="muted">{active.description}</p>

      {active.theses.length > 0 ? (
        <>
          <div className="grid grid-2">
            {active.theses.map((t) => (
              <div key={t.claim} className="card">
                <div className="row spread">
                  <AssessmentBadge value={t.assessment} />
                  <span className="tag">{t.ticker}</span>
                </div>
                <p style={{ margin: '12px 0 4px' }}><strong>“{t.claim}”</strong></p>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{t.keyEvidence}</p>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>Coverage: {t.coverage}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <GrowthChart title="BBRI quarterly growth, year-on-year" data={BBRI_GROWTH} />
            <p className="muted" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
              Source: Sectors quarterly financials. Same-quarter YoY computed by Counterpoint.
            </p>
          </div>
        </>
      ) : (
        <div className="card muted">No theses in this workspace yet. <Link href="/app/verify">Run a new check</Link> to add one.</div>
      )}

      <h2>Agent suggestions</h2>
      <div className="grid">
        {active.suggestions.map((s) => (
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
