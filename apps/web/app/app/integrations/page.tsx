import { Code2, MessagesSquare, Send } from 'lucide-react';
import { PreviewBanner } from '@/components/PreviewBanner';

const INTEGRATIONS = [
  {
    icon: Send,
    name: 'Telegram bot',
    tier: 'Pro',
    body: 'Forward any stock thesis or screenshot to the bot and get the evidence check back in the chat, with a link to the full report.',
  },
  {
    icon: MessagesSquare,
    name: 'Telegram & Discord groups',
    tier: 'Community',
    body: 'Add Counterpoint to an investing community. Reply /cek to a thesis and the bot posts an evidence-backed fact-check for everyone.',
  },
  {
    icon: Code2,
    name: 'Evidence API',
    tier: 'Business',
    body: 'Brokerages and financial media send theses over REST and receive structured claims, assessments and traceable evidence.',
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p className="muted">Bring the evidence check to the places where stock theses are shared.</p>
        </div>
      </div>
      <PreviewBanner>Integrations are on the roadmap. The chat shows the planned Telegram experience using real Sectors results.</PreviewBanner>

      <div className="grid grid-2">
        <div className="stack">
          {INTEGRATIONS.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.name} className="card">
                <div className="row spread">
                  <span className="row">
                    <span className="feature-icon" style={{ marginBottom: 0 }}><Icon size={20} aria-hidden="true" /></span>
                    <strong>{i.name}</strong>
                  </span>
                  <span className="tag">{i.tier}</span>
                </div>
                <p className="muted" style={{ margin: '10px 0 12px' }}>{i.body}</p>
                <button className="secondary" disabled>Connect (coming soon)</button>
              </div>
            );
          })}
        </div>

        <div className="card">
          <strong>Telegram group: Diskusi Saham Bank</strong>
          <div className="chat" style={{ marginTop: 12 }} aria-label="Example Telegram conversation">
            <div className="bubble">
              <div className="who">Andi</div>
              BBRI masih menarik karena growth kuat dan valuasinya murah dibanding bank besar lain 🚀
            </div>
            <div className="bubble me">
              <div className="who">Rina</div>
              /cek
            </div>
            <div className="bubble">
              <div className="who">Counterpoint</div>
              Checked 2 claims about <strong>BBRI</strong> with Sectors data.
              <br />
              <br /><strong>“growth kuat”: Partially supported</strong>
              <br />Net income +22.3% YoY (2026Q2 vs 2025Q2), but FY2025 revenue −9.2%.
              <br />
              <br /><strong>“murah dibanding bank besar lain”: Not supported</strong>
              <br />P/E 7.58x is 0.5% above the median of 9 large banks.
              <br />
              <br /><span style={{ fontSize: '0.78rem', opacity: 0.75 }}>Evidence check only, not investment advice.</span>
              <div className="actions">
                <span>Full report</span>
                <span>Compare with BUMN banks only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
