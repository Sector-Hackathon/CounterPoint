'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AssessmentBadge } from '@/components/AssessmentBadge';
import { GrowthChart } from '@/components/GrowthChart';
import { PreviewBanner } from '@/components/SiteNav';
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

// Snapshot of real live-check results (Sectors v2, 2026-09-27). Static for the preview.
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
      'Re-run these theses automatically when Q3 2026 financials are published?',
    ],
  },
  {
    id: 'dividend',
    name: 'Dividend ideas',
    description: 'Yield claims from Telegram groups. Empty in this preview.',
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

export default function WorkspacePage() {
  const [activeId, setActiveId] = useState(WORKSPACES[0]!.id);
  const active = WORKSPACES.find((w) => w.id === activeId)!;

  return (
    <main className="wide">
      <PreviewBanner>
        Workspaces let you group theses, track how the evidence changes, and act on the agent’s suggested next checks.
        Data shown is a static snapshot of real Sectors results from 27 Sep 2026.
      </PreviewBanner>
      <div className="workspace-layout">
        <aside aria-label="Workspaces">
          <h2 style={{ marginTop: 0 }}>Workspaces</h2>
          {WORKSPACES.map((w) => (
            <button key={w.id} className="ws-item" aria-current={w.id === activeId} onClick={() => setActiveId(w.id)}>
              {w.name} <span className="muted">({w.theses.length})</span>
            </button>
          ))}
          <button className="secondary" disabled style={{ marginTop: 10, width: '100%' }}>+ New workspace</button>
        </aside>

        <section>
          <h1 style={{ fontSize: '1.6rem' }}>{active.name}</h1>
          <p className="muted">{active.description}</p>

          {active.theses.length > 0 && (
            <>
              <div className="grid grid-2">
                {active.theses.map((t) => (
                  <div key={t.claim} className="card" style={{ margin: 0 }}>
                    <div className="row">
                      <AssessmentBadge value={t.assessment} />
                      <span className="tag">{t.ticker}</span>
                    </div>
                    <p style={{ margin: '8px 0 4px' }}><strong>“{t.claim}”</strong></p>
                    <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{t.keyEvidence}</p>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Coverage: {t.coverage}</p>
                  </div>
                ))}
              </div>

              <div className="card">
                <GrowthChart title="BBRI quarterly growth, year-on-year" data={BBRI_GROWTH} />
                <p className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
                  Source: Sectors quarterly financials, same-quarter YoY computed by Counterpoint.
                </p>
              </div>
            </>
          )}

          <h2>Agent suggestions</h2>
          <div className="grid">
            {active.suggestions.map((s) => (
              <div key={s} className="card row" style={{ margin: 0, justifyContent: 'space-between' }}>
                <span>{s}</span>
                <button className="secondary" disabled>Run check</button>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 20 }}>
            <Link href="/">Verify a new thesis →</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
