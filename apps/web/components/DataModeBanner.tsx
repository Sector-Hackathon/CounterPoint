'use client';

/**
 * States plainly which evidence the session is built on. A viewer must never have to guess
 * whether a number came from Sectors or from the synthetic development fixture, so both modes
 * are announced, not just the synthetic one. Every evidence item's source locator
 * (`sectors:` / `fixture:`) says the same thing again in the evidence drawer.
 */
export function DataModeBanner({ mode }: { mode: 'live' | 'fixture' | null }) {
  if (mode === null) return null;
  const fixture = mode === 'fixture';
  return (
    <p className="data-mode" data-mode={mode} role="note">
      <strong>{fixture ? 'Synthetic fixture data' : 'Live Sectors data'}</strong>
      {fixture
        ? ' — illustrative numbers for development and tests. Not real company financials, and not from Sectors.'
        : ' — every figure below was retrieved from the Sectors API for this session.'}
    </p>
  );
}
