'use client';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import type { ClaimState } from '@/lib/session-state';
import { Status } from './Status';

/**
 * The input screen's one orchestrated moment: each claim's quote lifts out of the thesis and
 * becomes a claim row (shared layoutId). Before `settled`, quotes are highlighted in place;
 * after, they live in the list and the thesis keeps a quiet underline.
 */
export function ThesisSplit({ rawThesis, claims, settled }: { rawThesis: string; claims: ClaimState[]; settled: boolean }) {
  const reduce = useReducedMotion();
  const spans = claims.filter((c) => c.span).sort((a, b) => a.span!.start - b.span!.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const c of spans) {
    if (c.span!.start < at) continue; // overlapping quotes: keep the first
    parts.push(rawThesis.slice(at, c.span!.start));
    const text = rawThesis.slice(c.span!.start, c.span!.end);
    parts.push(
      settled ? (
        <span key={c.id} style={{ textDecoration: 'underline', textDecorationColor: 'var(--rule)', textUnderlineOffset: 4 }}>{text}</span>
      ) : (
        <motion.mark key={c.id} layoutId={reduce ? undefined : `claim-${c.id}`} className="claim-span" data-verifiable={c.verifiability}>
          {text}
        </motion.mark>
      ),
    );
    at = c.span!.end;
  }
  parts.push(rawThesis.slice(at));

  return (
    <LayoutGroup>
      <blockquote style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 2.6vw, 1.7rem)', lineHeight: 1.35, maxWidth: '40ch' }}>
        {parts}
      </blockquote>
      {settled && (
        <ol style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'grid', gap: 10 }}>
          {claims.map((c) => (
            <motion.li
              key={c.id}
              layoutId={reduce || !c.span ? undefined : `claim-${c.id}`}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="sheet"
              style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}
            >
              <span style={{ fontWeight: 600 }}>“{c.originalText}”</span>
              <span style={{ marginLeft: 'auto' }}><Status value={c.verifiability === 'NO' ? 'UNVERIFIABLE' : c.assessment} /></span>
            </motion.li>
          ))}
        </ol>
      )}
    </LayoutGroup>
  );
}
