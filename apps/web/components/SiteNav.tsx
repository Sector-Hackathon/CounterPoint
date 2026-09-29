import Link from 'next/link';

export function SiteNav() {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <Link href="/" className="brand">Counterpoint</Link>
        <Link href="/">Verify</Link>
        <Link href="/workspace">Workspace<span className="preview-pill">Preview</span></Link>
        <Link href="/integrations">Integrations<span className="preview-pill">Preview</span></Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/login" className="button" style={{ padding: '6px 14px' }}>Sign in</Link>
      </div>
    </nav>
  );
}

export function PreviewBanner({ children }: { children?: React.ReactNode }) {
  return (
    <p className="preview-banner" role="note">
      <strong>Product preview.</strong> {children ?? 'This screen shows the planned product direction and is not wired to live data yet.'}
    </p>
  );
}
