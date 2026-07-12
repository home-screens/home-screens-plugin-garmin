import React from 'react';
import { PALETTE } from './theme';

/** Circular progress ring (steps). ratio in [0,1]; overflow is clamped.
 *  `inner` draws a second concentric ring just inside the first (intensity
 *  minutes on the summary view at medium+). */
export function Ring({
  ratio, size, stroke, color, label, sub, inner,
}: {
  ratio: number; size: number; stroke: number; color: string; label: string; sub: string;
  inner?: { ratio: number; color: string };
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const ri = r - stroke - 3;
  const ci = 2 * Math.PI * ri;
  const innerClamped = inner ? Math.max(0, Math.min(1, inner.ratio)) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE.rail} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
        />
        {inner && (
          <>
            <circle cx={size / 2} cy={size / 2} r={ri} fill="none" stroke={PALETTE.rail} strokeWidth={stroke * 0.6} />
            <circle
              cx={size / 2} cy={size / 2} r={ri} fill="none" stroke={inner.color} strokeWidth={stroke * 0.6}
              strokeLinecap="round" strokeDasharray={ci} strokeDashoffset={ci * (1 - innerClamped)}
            />
          </>
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1.1,
      }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: size * 0.09, opacity: 0.6 }}>{sub}</div>
      </div>
    </div>
  );
}

/** Semi-circular gauge for Body Battery (0-100). */
export function Gauge({ value, size, color }: { value: number; size: number; color: string }) {
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const start = Math.PI; // 180deg — arc opens upward
  const end = start + Math.PI * Math.max(0, Math.min(1, value / 100));
  const arc = (a0: number, a1: number) =>
    `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  return (
    <svg width={size} height={size / 2 + 12}>
      <path d={arc(start, start + Math.PI)} fill="none" stroke={PALETTE.rail} strokeWidth={14} strokeLinecap="round" />
      <path d={arc(start, end)} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="currentColor">
        {Math.round(value)}
      </text>
    </svg>
  );
}

/** Horizontal stacked bar for sleep stages. segments: [value, color][]. */
export function StackedBar({ segments, height }: { segments: [number, string][]; height: number }) {
  const total = segments.reduce((s, [v]) => s + v, 0) || 1;
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: height / 2, overflow: 'hidden', background: PALETTE.rail }}>
      {segments.map(([v, color], i) => (
        <div key={i} style={{ width: `${(v / total) * 100}%`, background: color }} />
      ))}
    </div>
  );
}

/** Filled area sparkline for the Body Battery day curve. */
export function Sparkline({
  points, width, height, color,
}: { points: { t: number; v: number }[]; width: number; height: number; color: string }) {
  if (points.length < 2) return <div style={{ height, opacity: 0.4, fontSize: 12 }}>No trend yet</div>;
  const xs = points.map((p) => p.t);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const sx = (t: number) => ((t - minX) / (maxX - minX || 1)) * width;
  const sy = (v: number) => height - (v / 100) * height;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      <path d={area} fill={color} opacity={0.18} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  );
}

/** A value marker on a horizontal rail with a highlighted target band
 *  (weekly load vs. optimal tunnel, last-night HRV vs. balanced range).
 *  Scale runs 0 → max; the marker is green inside the band, amber outside. */
export function MarkerBar({ value, bandLow, bandHigh, max, width, height: h = 26 }: {
  value: number; bandLow: number; bandHigh: number; max: number; width: number; height?: number;
}) {
  const x = (v: number) => Math.max(0, Math.min(1, v / (max || 1))) * width;
  const inBand = value >= bandLow && value <= bandHigh;
  return (
    <svg width={width} height={h} style={{ maxWidth: '100%' }}>
      <rect x={0} y={h / 2 - 5} width={width} height={10} rx={5} fill={PALETTE.rail} />
      <rect
        x={x(bandLow)} y={h / 2 - 5} width={Math.max(0, x(bandHigh) - x(bandLow))}
        height={10} rx={5} fill={PALETTE.bodyBattery} opacity={0.35}
      />
      <circle
        cx={Math.min(Math.max(x(value), 8), width - 8)} cy={h / 2} r={8}
        fill={inBand ? PALETTE.bodyBattery : PALETTE.stress}
      />
    </svg>
  );
}

export function StatTile({ label, value, unit, color, align = 'left', valueSize = 26 }: {
  label: string; value: string; unit?: string; color?: string;
  align?: 'left' | 'center'; valueSize?: number;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align,
    }}>
      <div style={{ fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: valueSize, fontWeight: 700, color: color ?? 'inherit' }}>
        {value}{unit && <span style={{ fontSize: Math.round(valueSize * 0.54), opacity: 0.6, marginLeft: 3, whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, padding: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 14, opacity: 0.65, maxWidth: 320 }}>{body}</div>
      {action}
    </div>
  );
}
