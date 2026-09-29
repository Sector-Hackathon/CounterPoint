import { Info } from 'lucide-react';

export function PreviewBanner({ children }: { children?: React.ReactNode }) {
  return (
    <p className="preview-banner" role="note">
      <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span>
        <strong>Product preview.</strong>{' '}
        {children ?? 'This screen shows the planned product direction and is not wired to live data yet.'}
      </span>
    </p>
  );
}
