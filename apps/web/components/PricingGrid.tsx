import Link from 'next/link';
import { Check } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: 'Rp0',
    period: '',
    audience: 'Curious retail investors',
    features: ['5 thesis checks per day', 'Full evidence report', 'Growth, dividend and valuation claims'],
    cta: 'Start checking',
    href: '/app/verify',
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

export function PricingGrid({ currentPlan }: { currentPlan?: string }) {
  return (
    <div className="grid grid-4">
      {PLANS.map((p) => (
        <div key={p.name} className={`card plan${p.featured ? ' featured' : ''}`}>
          <div className="row spread">
            <strong>{p.name}</strong>
            {currentPlan === p.name ? <span className="tag">Current plan</span> : p.featured && <span className="tag">Most popular</span>}
          </div>
          <div>
            <span className="price">{p.price}</span> <span className="muted">{p.period}</span>
          </div>
          <span className="muted" style={{ fontSize: '0.9rem' }}>{p.audience}</span>
          <ul>
            {p.features.map((f) => (
              <li key={f}><Check size={16} aria-hidden="true" style={{ color: 'var(--link)', marginTop: 4, flexShrink: 0 }} />{f}</li>
            ))}
          </ul>
          {p.href && currentPlan !== p.name ? (
            <Link className="button" href={p.href}>{p.cta}</Link>
          ) : (
            <button className="secondary" disabled>{currentPlan === p.name ? 'Your plan' : p.cta}</button>
          )}
        </div>
      ))}
    </div>
  );
}
