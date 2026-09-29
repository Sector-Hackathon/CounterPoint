const PLANS = [
  {
    name: 'Free',
    price: 'Rp0',
    period: '',
    audience: 'Curious retail investors',
    features: ['5 thesis checks per day', 'Full evidence report', 'Growth, dividend and valuation claims'],
    cta: 'Start checking',
    href: '/',
  },
  {
    name: 'Pro',
    price: 'Rp49rb',
    period: '/month',
    audience: 'Active self-directed investors',
    features: ['Unlimited thesis checks', 'Personal Telegram bot', 'Workspaces & report history', 'Screenshot-to-thesis'],
    cta: 'Coming soon',
    featured: true,
  },
  {
    name: 'Community',
    price: 'Rp299rb',
    period: '/month per group',
    audience: 'Telegram & Discord investing groups',
    features: ['/cek fact-checks inside the group', 'Shared workspace for admins', 'Usage insights'],
    cta: 'Coming soon',
  },
  {
    name: 'Business',
    price: 'Custom',
    period: '',
    audience: 'Brokerages & financial media',
    features: ['Evidence API', 'Custom claim contracts', 'SLA and audit logs'],
    cta: 'Contact us',
  },
];

export default function PricingPage() {
  return (
    <main className="wide">
      <h1>Pricing</h1>
      <p className="muted">
        Every plan uses the same evidence rules: deterministic checks, traceable numbers, and no buy/sell recommendations.
        Paid plans are planned and not yet available.
      </p>
      <div className="grid grid-3" style={{ marginTop: 18 }}>
        {PLANS.map((p) => (
          <div key={p.name} className={`card plan${p.featured ? ' featured' : ''}`} style={{ margin: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{p.name}</strong>
              {p.featured && <span className="tag">Most popular</span>}
            </div>
            <div>
              <span className="price">{p.price}</span> <span className="muted">{p.period}</span>
            </div>
            <span className="muted" style={{ fontSize: '0.9rem' }}>{p.audience}</span>
            <ul>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {p.href ? (
              <a className="button" href={p.href} style={{ textAlign: 'center' }}>{p.cta}</a>
            ) : (
              <button className="secondary" disabled>{p.cta}</button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
