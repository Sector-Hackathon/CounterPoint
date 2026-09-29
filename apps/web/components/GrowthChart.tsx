'use client';

import { useState } from 'react';

export interface GrowthPoint {
  period: string;
  revenue: number;
  earnings: number;
}

const SERIES = [
  { key: 'revenue', label: 'Revenue YoY', color: 'var(--series-1)' },
  { key: 'earnings', label: 'Net income YoY', color: 'var(--series-2)' },
] as const;

const W = 560;
const H = 240;
const PAD = { top: 20, right: 12, bottom: 28, left: 40 };
const BAR = 18;
const GAP = 2;
const R = 4;

/** Bar with only the data end rounded; the baseline end stays square. */
function barPath(x: number, y0: number, y1: number, w: number): string {
  const up = y1 < y0;
  const h = Math.abs(y1 - y0);
  const r = Math.min(R, h, w / 2);
  if (h === 0) return '';
  return up
    ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`
    : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

export function GrowthChart({ data, title }: { data: GrowthPoint[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = data.flatMap((d) => [d.revenue, d.earnings]);
  const max = Math.ceil(Math.max(0, ...values) / 5) * 5;
  const min = Math.floor(Math.min(0, ...values) / 5) * 5;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / (max - min || 1)) * plotH;
  const band = (W - PAD.left - PAD.right) / data.length;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += 5) ticks.push(t);
  const last = data.length - 1;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption><strong>{title}</strong></figcaption>
      <div className="legend" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. See table below for values.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{t}%</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const x0 = cx - BAR - GAP / 2;
            return (
              <g key={d.period} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />
                {SERIES.map((s, si) => {
                  const v = d[s.key];
                  const x = x0 + si * (BAR + GAP);
                  return (
                    <g key={s.key}>
                      <path d={barPath(x, y(0), y(v), BAR)} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />
                      {i === last && (
                        <text className="value-label" x={x + BAR / 2} y={v >= 0 ? y(v) - 5 : y(v) + 13} textAnchor="middle">
                          {v.toFixed(1)}%
                        </text>
                      )}
                    </g>
                  );
                })}
                <text className="tick" x={cx} y={H - 8} textAnchor="middle">{d.period}</text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="tooltip"
            style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`, top: `${(y(Math.max(0, data[hover]!.revenue, data[hover]!.earnings)) / H) * 100}%` }}
          >
            <strong>{data[hover]!.period}</strong>
            {SERIES.map((s) => (
              <div key={s.key}>
                <span className="swatch" style={{ background: s.color }} />
                {s.label}: {data[hover]![s.key].toFixed(1)}%
              </div>
            ))}
          </div>
        )}
      </div>
      <details>
        <summary>Table view</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quarter</th>{SERIES.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.period}><td>{d.period}</td><td>{d.revenue.toFixed(1)}%</td><td>{d.earnings.toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
