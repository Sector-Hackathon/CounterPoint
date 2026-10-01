'use client';
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { formatValue } from '@/lib/format';

export function CountUp({ value, unit }: { value: number | null; unit: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || value === null) return;
    if (reduce) { el.textContent = formatValue(value, unit); return; }
    const controls = animate(0, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = formatValue(v, unit); } });
    return () => controls.stop();
  }, [value, unit, reduce]);
  return <span ref={ref} aria-label={formatValue(value, unit)}>{formatValue(value, unit)}</span>;
}
