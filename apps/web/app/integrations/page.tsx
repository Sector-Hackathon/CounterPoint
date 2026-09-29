import { PreviewBanner } from '@/components/SiteNav';

const INTEGRATIONS = [
  {
    name: 'Telegram bot',
    tier: 'Pro',
    body: 'Forward any stock thesis or screenshot to the bot and get the evidence check back in the chat, with a link to the full report.',
  },
  {
    name: 'Telegram & Discord groups',
    tier: 'Community',
    body: 'Add Counterpoint to an investing community. Reply /cek to a thesis and the bot posts an evidence-backed fact-check for everyone.',
  },
  {
    name: 'Evidence API',
    tier: 'Business',
    body: 'Brokerages and financial media send theses over REST and receive structured claims, assessments and traceable evidence items.',
  },
];

export default function IntegrationsPage() {
  return (
    <main className="wide">
      <PreviewBanner>Integrations are on the roadmap. The chat below illustrates the planned Telegram experience using real Sectors results.</PreviewBanner>
      <h1>Check theses where they are shared</h1>
      <p className="muted">
        Stock theses spread in Telegram groups, Discord servers and social posts. Counterpoint brings the evidence check to those places.
      </p>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="grid">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{i.name}</strong>
                <span className="tag">{i.tier}</span>
              </div>
              <p className="muted" style={{ margin: '6px 0 10px' }}>{i.body}</p>
              <button className="secondary" disabled>Connect (coming soon)</button>
            </div>
          ))}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <strong>Telegram group: Diskusi Saham Bank</strong>
          <div className="chat" style={{ marginTop: 10 }} aria-label="Example Telegram conversation">
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
              🔎 Checking 2 claims about <strong>BBRI</strong> with Sectors data…
              <br />
              <br />◐ <strong>“growth kuat”: Partially supported</strong>
              <br />Net income +22.3% YoY (2026Q2 vs 2025Q2), but FY2025 revenue −9.2%.
              <br />
              <br />○ <strong>“murah dibanding bank besar lain”: Not supported</strong>
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
    </main>
  );
}
