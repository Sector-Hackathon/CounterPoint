'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CreditCard, FolderKanban, LayoutDashboard, LogOut, Menu, Plug, SearchCheck, X } from 'lucide-react';
import { Brand } from './Brand';

const NAV = [
  { section: 'Research', items: [
    { href: '/app', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/app/verify', label: 'New check', icon: SearchCheck, match: ['/app/verify', '/app/theses'] },
    { href: '/app/workspaces', label: 'Workspaces', icon: FolderKanban, preview: true },
  ] },
  { section: 'Account', items: [
    { href: '/app/integrations', label: 'Integrations', icon: Plug, preview: true },
    { href: '/app/plan', label: 'Plan & billing', icon: CreditCard, preview: true },
  ] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: { href: string; exact?: boolean; match?: string[] }) =>
    item.exact ? pathname === item.href : (item.match ?? [item.href]).some((m) => pathname.startsWith(m));

  return (
    <div className="shell">
      <div className="mobile-bar">
        <Brand href="/app" />
        <button className="ghost" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside className="sidebar" data-open={open} aria-label="Sidebar">
        <Brand href="/app" />
        <nav aria-label="Main">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="nav-link" aria-current={isActive(item) ? 'page' : undefined}>
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                    {'preview' in item && item.preview && <span className="preview-pill">Preview</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">DI</span>
            <div>
              <div style={{ fontWeight: 600 }}>Demo investor</div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Free plan</div>
            </div>
          </div>
          <Link href="/" className="nav-link">
            <LogOut size={18} aria-hidden="true" /> Sign out
          </Link>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
