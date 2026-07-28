import React from 'react';
import type { SportKey, TracePoint, Traces, Units, WeeklyDay, Zone } from './types';
import { PALETTE } from './theme';
import { formatDuration, formatDistance, formatPace, formatMinSec } from './format';
import { sportFor, type Sport } from './sports';
import { Sparkline } from './components';
import { useScale } from './scale';

// ─── TraceChart ─────────────────────────────────────────────────────
/** The hero's chart: elevation as a rail-toned filled area, HR as a line,
 *  sharing the x-axis. Each series is normalized to its own min/max. Renders
 *  whichever traces exist; null-traces callers should skip rendering. */
export function TraceChart({ traces, width, height }: { traces: Traces; width: number; height: number }) {
  const u = useScale();
  const hasHr = traces.hr.length >= 2;
  const hasElev = traces.elevation.length >= 2;
  if (!hasHr && !hasElev) return null;
  const xs = [...(hasHr ? traces.hr : []), ...(hasElev ? traces.elevation : [])].map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const sx = (x: number) => ((x - minX) / (maxX - minX || 1)) * width;
  const scaleY = (pts: TracePoint[], pad: number) => {
    const vs = pts.map((p) => p.v);
    const min = Math.min(...vs);
    const span = Math.max(...vs) - min || 1;
    return (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  };
  const path = (pts: TracePoint[], sy: (v: number) => number) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');

  return (
    // viewBox + preserveAspectRatio: when CSS clamps the element narrower
    // than the coordinate width (mid-resize), the drawing scales instead of
    // clipping off the right edge.
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none" style={{ maxWidth: '100%' }}
    >
      {hasElev && (
        <path
          d={`${path(traces.elevation, scaleY(traces.elevation, 6))} L ${width} ${height} L 0 ${height} Z`}
          fill={PALETTE.rail}
        />
      )}
      {hasHr && (
        <path
          d={path(traces.hr, scaleY(traces.hr, 6))}
          fill="none" stroke={PALETTE.heart} strokeWidth={u(2)} strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// ─── ZoneBars ───────────────────────────────────────────────────────
const ZONE_COLORS = [PALETTE.z1, PALETTE.z2, PALETTE.z3, PALETTE.z4, PALETTE.z5];

/** Five horizontal HR-zone bars, widths proportional to seconds-in-zone. */
export function ZoneBars({ zones }: { zones: Zone[] }) {
  const u = useScale();
  const max = Math.max(...zones.map((z) => z.secsInZone), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: u(5) }}>
      {zones.map((z) => (
        <div key={z.zoneNumber} style={{ display: 'flex', alignItems: 'center', gap: u(8), fontSize: u(12) }}>
          <span style={{ width: u(20), opacity: 0.6 }}>Z{z.zoneNumber}</span>
          <div style={{ flex: 1, height: u(10), borderRadius: u(5), background: PALETTE.rail }}>
            <div style={{
              width: `${(z.secsInZone / max) * 100}%`, height: '100%', borderRadius: u(5),
              background: ZONE_COLORS[z.zoneNumber - 1],
            }} />
          </div>
          <span style={{ width: u(56), textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>
            {formatMinSec(z.secsInZone)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── SplitsTable ────────────────────────────────────────────────────
/** Compact splits table capped at maxRows; shows "+N more" when truncated. */
export function SplitsTable({ splits, units, maxRows }: {
  splits: { index: number; distanceMeters: number; durationSeconds: number; avgHr: number | null }[];
  units: Units; maxRows: number;
}) {
  const u = useScale();
  const shown = splits.slice(0, maxRows);
  const hidden = splits.length - shown.length;
  const cols = `${u(32)}px 1fr 1fr 1fr ${u(48)}px`;
  return (
    <div style={{ fontSize: u(13) }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: u(4), paddingBottom: u(4),
        opacity: 0.55, fontSize: u(11), textTransform: 'uppercase', letterSpacing: u(0.5),
      }}>
        <span>#</span><span>Dist</span><span>Time</span><span>Pace</span>
        <span style={{ textAlign: 'right' }}>HR</span>
      </div>
      {shown.map((s) => {
        const speed = s.durationSeconds > 0 && s.distanceMeters > 0
          ? s.distanceMeters / s.durationSeconds : null;
        return (
          <div key={s.index} style={{
            display: 'grid', gridTemplateColumns: cols, gap: u(4), padding: `${u(3)}px 0`,
            fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${PALETTE.rail}`,
          }}>
            <span style={{ opacity: 0.6 }}>{s.index}</span>
            <span>{formatDistance(s.distanceMeters, units)}</span>
            <span>{formatMinSec(s.durationSeconds)}</span>
            <span>{formatPace(speed, units)}</span>
            <span style={{ textAlign: 'right' }}>{s.avgHr != null ? Math.round(s.avgHr) : '--'}</span>
          </div>
        );
      })}
      {hidden > 0 && <div style={{ opacity: 0.5, fontSize: u(12), paddingTop: u(4) }}>+{hidden} more</div>}
    </div>
  );
}

// ─── DayBars ────────────────────────────────────────────────────────
/** 7 vertical bars stacked by sport color; today gets full opacity + bold label. */
export function DayBars({ days, height }: { days: WeeklyDay[]; height: number }) {
  const u = useScale();
  const max = Math.max(...days.map((d) => d.totalSeconds), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(8) }}>
      {days.map((d) => (
        <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(4) }}>
          <div style={{
            width: '100%', height, display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-end', borderRadius: u(6), overflow: 'hidden',
            background: PALETTE.rail, opacity: d.isToday ? 1 : 0.75,
          }}>
            {(Object.entries(d.bySport) as [SportKey, number][]).map(([sport, secs]) => (
              <div key={sport} style={{ height: `${(secs / max) * 100}%`, background: PALETTE.sports[sport] }} />
            ))}
          </div>
          <span style={{
            fontSize: u(11), opacity: d.isToday ? 0.9 : 0.5, fontWeight: d.isToday ? 700 : 400,
          }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── BandLineChart ──────────────────────────────────────────────────
/** Min/max-scaled line (unlike Sparkline's fixed 0–100 axis) with an optional
 *  horizontal reference band behind it — nightly HRV against the balanced
 *  range, or today's heart rate with no band. */
export function BandLineChart({ points, width, height, color, band }: {
  points: { t: number; v: number }[];
  width: number; height: number; color: string;
  band?: { low: number; high: number };
}) {
  const u = useScale();
  if (points.length < 2) return <div style={{ height, opacity: 0.4, fontSize: u(12) }}>No trend yet</div>;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs, band?.low ?? Infinity);
  const hi = Math.max(...vs, band?.high ?? -Infinity);
  const pad = (hi - lo || 1) * 0.12;
  const minV = lo - pad;
  const spanV = hi + pad - minV;
  const xs = points.map((p) => p.t);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const sx = (t: number) => ((t - minX) / (maxX - minX || 1)) * width;
  const sy = (v: number) => height - ((v - minV) / spanV) * height;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      {band && (
        <rect
          x={0} y={sy(band.high)} width={width}
          height={Math.max(0, sy(band.low) - sy(band.high))}
          fill={PALETTE.bodyBattery} opacity={0.14}
        />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={u(2.5)} strokeLinejoin="round" />
    </svg>
  );
}

// ─── SportBadge ─────────────────────────────────────────────────────
/** Geometric stroke glyphs — no emoji (household rule); unknown sports fall
 *  back to 3-letter label initials. */
const GLYPHS: Partial<Record<SportKey, React.ReactNode>> = {
  running: <path d="M6 4l7 8-7 8M13 4l7 8-7 8" />,
  walking: <path d="M9 4l7 8-7 8" />,
  cycling: (
    <>
      <circle cx="6.5" cy="16.5" r="3.5" />
      <circle cx="17.5" cy="16.5" r="3.5" />
      <path d="M6.5 16.5L10 9h4.5l3 7.5M10 9L8 5h3" />
    </>
  ),
  swimming: <path d="M2 9q2.5-3 5 0t5 0 5 0 5 0M2 15q2.5-3 5 0t5 0 5 0 5 0" />,
  hiking: <path d="M3 19l6-10 4 6 3-4 5 8z" fill="currentColor" stroke="none" />,
  strength: <path d="M2 12h3m14 0h3M7 7v10M17 7v10M7 12h10" />,
};

/** Colored rounded square with the sport's glyph. Accepts a Sport so callers
 *  with only a SportKey (weekly totals) can use sportByKey. */
export function SportBadge({ sport, size }: { sport: Sport; size?: number }) {
  const u = useScale();
  // Callers passing an explicit size have already scaled it.
  const box = size ?? u(44);
  const glyph = GLYPHS[sport.key];
  return (
    <span style={{
      width: box, height: box, borderRadius: box * 0.27, flexShrink: 0,
      background: `${sport.color}26`, color: sport.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: box * 0.26, fontWeight: 700,
    }}>
      {glyph ? (
        <svg
          width={box * 0.55} height={box * 0.55} viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
        >
          {glyph}
        </svg>
      ) : sport.label.slice(0, 3)}
    </span>
  );
}

/** Convenience wrapper for callers holding a raw typeKey (list rows, hero). */
export function SportBadgeFor({ typeKey, size }: { typeKey: string; size?: number }) {
  return <SportBadge sport={sportFor(typeKey)} size={size} />;
}

// ─── BatteryStressChart ─────────────────────────────────────────────
/** Body Battery area + stress line on a shared 0–100 y-axis, with high/low
 *  markers on the battery curve and a small legend. Falls back to the plain
 *  Sparkline message when there is nothing to draw. */
export function BatteryStressChart({ battery, stress, width, height }: {
  battery: { t: number; v: number }[];
  stress: { t: number; v: number }[];
  width: number; height: number;
}) {
  const u = useScale();
  if (battery.length < 2 && stress.length < 2) {
    return <Sparkline points={battery} width={width} height={height} color={PALETTE.bodyBattery} />;
  }
  const all = [...battery, ...stress];
  const minX = Math.min(...all.map((p) => p.t));
  const maxX = Math.max(...all.map((p) => p.t));
  const sx = (t: number) => ((t - minX) / (maxX - minX || 1)) * width;
  const sy = (v: number) => height - (v / 100) * height;
  const line = (pts: { t: number; v: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  const hi = battery.length ? battery.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const lo = battery.length ? battery.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  const dot = (color: string): React.CSSProperties => ({
    width: u(8), height: u(8), borderRadius: u(2), background: color, display: 'inline-block', marginRight: u(5),
  });
  return (
    <div>
      <svg width={width} height={height} style={{ maxWidth: '100%' }}>
        {battery.length >= 2 && (
          <>
            <path
              d={`${line(battery)} L ${sx(battery[battery.length - 1].t).toFixed(1)} ${height} L ${sx(battery[0].t).toFixed(1)} ${height} Z`}
              fill={PALETTE.bodyBattery} opacity={0.15}
            />
            <path d={line(battery)} fill="none" stroke={PALETTE.bodyBattery} strokeWidth={u(2.5)} strokeLinejoin="round" />
          </>
        )}
        {stress.length >= 2 && (
          <path d={line(stress)} fill="none" stroke={PALETTE.stress} strokeWidth={u(1.5)} opacity={0.85} strokeLinejoin="round" />
        )}
        {hi && <circle cx={sx(hi.t)} cy={sy(hi.v)} r={u(3.5)} fill={PALETTE.bodyBattery} />}
        {lo && hi !== lo && <circle cx={sx(lo.t)} cy={sy(lo.v)} r={u(3.5)} fill={PALETTE.stress} />}
      </svg>
      <div style={{ display: 'flex', gap: u(16), fontSize: u(11), opacity: 0.7, marginTop: u(4) }}>
        <span><span style={dot(PALETTE.bodyBattery)} />Body Battery{hi ? ` · high ${hi.v}` : ''}{lo ? ` · low ${lo.v}` : ''}</span>
        <span><span style={dot(PALETTE.stress)} />Stress</span>
      </div>
    </div>
  );
}
