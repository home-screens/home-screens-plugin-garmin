import React from 'react';
import { PALETTE } from './theme';
import { useScale } from './scale';

/** Circular progress ring (steps). ratio in [0,1]; overflow is clamped.
 *  `inner` draws a second concentric ring just inside the first (intensity
 *  minutes on the summary view at medium+). */
export function Ring({
  ratio, size, stroke, color, label, sub, inner,
}: {
  ratio: number; size: number; stroke: number; color: string; label: string; sub: string;
  inner?: { ratio: number; color: string };
}) {
  const u = useScale();
  // `stroke` is scaled by the host's Text size, but `size` comes from the
  // measured box and is not. On a small module at a large Text size the
  // authored stroke can be wider than this diameter can physically draw —
  // the inner ring's radius goes negative and SVG drops both circles, so the
  // intensity ring silently disappears. Cap the stroke at the widest this
  // diameter can carry with the inner ring still intact.
  const inset = u(3);
  const w = Math.max(1, Math.min(stroke, inner ? (size - 2 * inset) / 4 : size / 2));
  const r = Math.max(0, (size - w) / 2);
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const ri = Math.max(0, r - w - inset);
  const ci = 2 * Math.PI * ri;
  const innerClamped = inner ? Math.max(0, Math.min(1, inner.ratio)) : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE.rail} strokeWidth={w} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={w}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
        />
        {inner && (
          <>
            <circle cx={size / 2} cy={size / 2} r={ri} fill="none" stroke={PALETTE.rail} strokeWidth={w * 0.6} />
            <circle
              cx={size / 2} cy={size / 2} r={ri} fill="none" stroke={inner.color} strokeWidth={w * 0.6}
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
  const u = useScale();
  const track = u(14);
  const r = size / 2 - track * 0.72;
  const cx = size / 2;
  const cy = size / 2;
  const start = Math.PI; // 180deg — arc opens upward
  const end = start + Math.PI * Math.max(0, Math.min(1, value / 100));
  const arc = (a0: number, a1: number) =>
    `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  return (
    <svg width={size} height={size / 2 + track * 0.86}>
      <path d={arc(start, start + Math.PI)} fill="none" stroke={PALETTE.rail} strokeWidth={track} strokeLinecap="round" />
      <path d={arc(start, end)} fill="none" stroke={color} strokeWidth={track} strokeLinecap="round" />
      <text x={cx} y={cy - u(4)} textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="currentColor">
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
  const u = useScale();
  if (points.length < 2) return <div style={{ height, opacity: 0.4, fontSize: u(12) }}>No trend yet</div>;
  const xs = points.map((p) => p.t);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const sx = (t: number) => ((t - minX) / (maxX - minX || 1)) * width;
  const sy = (v: number) => height - (v / 100) * height;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      <path d={area} fill={color} opacity={0.18} />
      <path d={line} fill="none" stroke={color} strokeWidth={u(2.5)} strokeLinejoin="round" />
    </svg>
  );
}

/** A value marker on a horizontal rail with a highlighted target band
 *  (weekly load vs. optimal tunnel, last-night HRV vs. balanced range).
 *  Scale runs 0 → max; the marker is green inside the band, amber outside. */
export function MarkerBar({ value, bandLow, bandHigh, max, width, height }: {
  value: number; bandLow: number; bandHigh: number; max: number; width: number; height?: number;
}) {
  const u = useScale();
  const h = height ?? u(26);
  // Rail and marker are proportions of the bar's own height, so they follow
  // both the scale and any explicit height a caller passes.
  const rail = h * (10 / 26);
  const knob = h * (8 / 26);
  const x = (v: number) => Math.max(0, Math.min(1, v / (max || 1))) * width;
  const inBand = value >= bandLow && value <= bandHigh;
  return (
    <svg width={width} height={h} style={{ maxWidth: '100%' }}>
      <rect x={0} y={h / 2 - rail / 2} width={width} height={rail} rx={rail / 2} fill={PALETTE.rail} />
      <rect
        x={x(bandLow)} y={h / 2 - rail / 2} width={Math.max(0, x(bandHigh) - x(bandLow))}
        height={rail} rx={rail / 2} fill={PALETTE.bodyBattery} opacity={0.35}
      />
      <circle
        cx={Math.min(Math.max(x(value), knob), width - knob)} cy={h / 2} r={knob}
        fill={inBand ? PALETTE.bodyBattery : PALETTE.stress}
      />
    </svg>
  );
}

export function StatTile({ label, value, unit, color, align = 'left', valueSize }: {
  label: string; value: string; unit?: string; color?: string;
  align?: 'left' | 'center'; valueSize?: number;
}) {
  const u = useScale();
  // Callers that pass an explicit size have already scaled it.
  const size = valueSize ?? u(26);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: u(2),
      alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align,
    }}>
      <div style={{ fontSize: u(12), opacity: 0.6, textTransform: 'uppercase', letterSpacing: u(0.5) }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 700, color: color ?? 'inherit' }}>
        {value}{unit && <span style={{ fontSize: Math.round(size * 0.54), opacity: 0.6, marginLeft: u(3), whiteSpace: 'nowrap' }}>{unit}</span>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  const u = useScale();
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: u(10), padding: u(24),
    }}>
      <div style={{ fontSize: u(18), fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: u(14), opacity: 0.65, maxWidth: u(320) }}>{body}</div>
      {action}
    </div>
  );
}
