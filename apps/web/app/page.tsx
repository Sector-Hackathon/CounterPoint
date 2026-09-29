import Link from 'next/link';
import {
  ArrowRight,
  Ban,
  Database,
  GitBranch,
  MessageCircle,
  Network,
  Quote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Split,
} from 'lucide-react';
import { AssessmentBadge } from '@/components/AssessmentBadge';
import { Brand } from '@/components/Brand';
import { PricingGrid } from '@/components/PricingGrid';

const STEPS = [
  { icon: Quote, title: 'Paste a thesis', body: 'Any stock narrative from Telegram, Stockbit or X, in Bahasa Indonesia or English.' },
  { icon: Split, title: 'Split into claims', body: 'The agent separates facts you can test from speculation it should not judge.' },
  { icon: GitBranch, title: 'Investigate adaptively', body: 'It checks Sectors data, and when evidence contradicts the claim it changes course to dig deeper.' },
  { icon: ScanSearch, title: 'Read the evidence', body: 'Each claim gets a verdict, the evidence for and against, and every number traced to its source.' },
];

const PILLARS = [
  { icon: Database, title: 'Real IDX data', body: 'Financials, dividends and valuations come from the Sectors API, never from the model’s memory.' },
  { icon: ShieldCheck, title: 'Every number is traceable', body: 'A validator removes any statement whose numbers cannot be matched to stored evidence.' },
  { icon: Network, title: 'Looks for counterevidence', body: 'It deliberately tests what would weaken the claim, and compares against a fixed, visible peer set.' },
  { icon: Ban, title: 'Honest about limits', body: 'Forward-looking claims and missing data are labelled Unverifiable. No buy, sell or hold advice.' },
];

export default function Landing() {
  return (
    <>
      <header className="landing-header">
        <div className="inner">
          <Brand />
          <nav aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#why">Why Counterpoint</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="actions row">
            <Link href="/login" className="button secondary">Sign in</Link>
            <Link href="/login" className="button">Try the demo</Link>
          </div>
        </div>
      </header>

      <section className="section hero">
        <div>
          <span className="eyebrow"><Sparkles size={14} aria-hidden="true" /> AI evidence agent for IDX stock theses</span>
          <h1>
            Every stock thesis <br />
            has a <span className="gradient-text">counterpoint.</span>
          </h1>
          <p className="lead">
            Paste a stock thesis. Counterpoint breaks it into testable claims, investigates each one against real Sectors data,
            actively looks for counterevidence, and tells you which parts actually hold up.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/login" className="button">Check a thesis <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#how" className="button secondary">See how it works</a>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 16 }}>
            Information and analysis only. Not investment advice.
          </p>
        </div>

        <div className="hero-card" aria-label="Example result">
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>Thesis from a Telegram group</div>
          <p className="thesis-quote" style={{ margin: 0 }}>
            “BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain, harga akan naik ke 6000.”
          </p>
          <div style={{ marginTop: 14 }}>
            <div className="claim-row">
              <div>
                <strong>Growth kuat</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>Net income +22.3% YoY, but FY2025 revenue −9.2%</div>
              </div>
              <AssessmentBadge value="PARTIALLY_SUPPORTED" />
            </div>
            <div className="claim-row">
              <div>
                <strong>Murah dibanding bank besar</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>P/E 7.58x, 0.5% above the 9-bank median</div>
              </div>
              <AssessmentBadge value="NOT_SUPPORTED" />
            </div>
            <div className="claim-row">
              <div>
                <strong>Harga akan naik ke 6000</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>Price targets are outside available evidence</div>
              </div>
              <AssessmentBadge value="UNVERIFIABLE" />
            </div>
          </div>
          <div className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>Real Sectors data, checked 27 Sep 2026</div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-title">
          <span className="eyebrow">How it works</span>
          <h2>An agent that investigates, not a chatbot that agrees</h2>
          <p className="muted">It plans what to check next based on what it has already found, within a strict budget.</p>
        </div>
        <div className="grid grid-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card step">
              <span className="num">{i + 1}</span>
              <h3 style={{ marginTop: 0 }}>{s.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="why">
        <div className="section-title">
          <span className="eyebrow">Why Counterpoint</span>
          <h2>Language models plan. Deterministic code decides.</h2>
          <p className="muted">
            The AI chooses what to investigate. Every calculation, comparison and verdict comes from tested code and versioned rules.
          </p>
        </div>
        <div className="grid grid-4">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="card">
                <span className="feature-icon"><Icon size={20} aria-hidden="true" /></span>
                <h3 style={{ marginTop: 0 }}>{p.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="grid grid-2" style={{ alignItems: 'center', gap: 40 }}>
          <div>
            <span className="eyebrow"><MessageCircle size={14} aria-hidden="true" /> Where theses live</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Check claims right inside your investing group</h2>
            <p className="muted">
              Reply <code>/cek</code> to any thesis in a Telegram or Discord group and Counterpoint posts an evidence-backed fact-check
              for everyone. The same agent is available on the web and through an API.
            </p>
            <span className="tag">Coming soon</span>
          </div>
          <div className="chat" aria-label="Example group chat">
            <div className="bubble"><div className="who">Andi</div>BBRI growth kuat, valuasi murah dibanding bank besar lain</div>
            <div className="bubble me"><div className="who">Rina</div>/cek</div>
            <div className="bubble">
              <div className="who">Counterpoint</div>
              <strong>Growth kuat: Partially supported.</strong> Net income +22.3% YoY, FY2025 revenue −9.2%.
              <br />
              <strong>Murah vs peers: Not supported.</strong> P/E 7.58x vs 9-bank median.
              <div className="actions"><span>Full report</span><span>Compare with BUMN banks</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="section-title">
          <span className="eyebrow">Pricing</span>
          <h2>Start free. Upgrade when your group needs it.</h2>
          <p className="muted">Paid plans are planned for launch after the hackathon.</p>
        </div>
        <PricingGrid />
      </section>

      <section className="section">
        <div className="cta-band">
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginTop: 0 }}>Before you believe the next hot tip, check it.</h2>
          <p className="muted">Paste a thesis and see what the evidence says in under a minute.</p>
          <Link href="/login" className="button" style={{ marginTop: 12 }}>Try the demo <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="footer">
        <div className="section row spread" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <span>© 2026 Counterpoint · Built for the Sectors Hackathon</span>
          <span>Information and analysis only. Not investment advice.</span>
        </div>
      </footer>
    </>
  );
}
