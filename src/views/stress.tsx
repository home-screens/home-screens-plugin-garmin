import React from 'react';
import type { GarminData, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StackedBar, Sparkline } from '../components';
import { formatDuration, sentencePhrase } from '../format';
import { isWide, stackGap } from '../size';

/** Garmin's stress bands and their app colors: Rest blue, Low yellow,
 *  Medium orange, High red. */
const LEVELS = [
  { key: 'rest', label: 'Rest', max: 25, color: '#3b82f6' },
  { key: 'low', label: 'Low', max: 50, color: '#fbbf24' },
  { key: 'medium', label: 'Medium', max: 75, color: '#f59e0b' },
  { key: 'high', label: 'High', max: 100, color: '#ef4444' },
] as const;

function levelFor(avg: number) {
  return LEVELS.find((l) => avg <= l.max) ?? LEVELS[LEVELS.length - 1];
}

/** Avg-stress hero + qualifier always; the time-in-level bar (with legend)
 *  and today's curve appear as the height budget fits, hero absorbing the
 *  leftover. Wide-short boxes get side-by-side panes (hero left, detail
 *  right). All data rides the daily bundle — no extra fetches. */
export function StressView({ data, width, height }: ViewProps) {
  const hasAny = data.stress != null || data.stressBreakdown != null || data.stressCurve.length >= 2;
  if (!hasAny) {
    return (
      <EmptyState
        title="No stress data yet"
        body="Your watch hasn't reported stress today. Give it a moment after syncing."
      />
    );
  }

  const wide = isWide(width, height);
  const gap = stackGap(height);
  const level = data.stress != null ? levelFor(data.stress) : null;

  // Height budget: hero ~(font + sub lines), breakdown block ~86 (bar 20 +
  // 2×2 legend), chart label 18; the chart absorbs what's left.
  const heroFont = height >= 500 ? 76 : 64;
  const heroH = heroFont + 30 + (data.stressQualifier ? 22 : 0);
  const BREAKDOWN_H = 86;
  const showBreakdown = data.stressBreakdown != null && (wide || height - heroH - gap >= BREAKDOWN_H + 60);
  const chartLeftover = height - heroH - (showBreakdown ? BREAKDOWN_H + gap : 0) - gap - 18 - 12;
  const showChart = data.stressCurve.length >= 2 && (wide || chartLeftover >= 70);
  const chartWidth = wide ? Math.min(width * 0.45, 480) : Math.min(width, 640);
  const chartHeight = wide
    ? Math.round(Math.max(70, Math.min(300, height - (showBreakdown ? BREAKDOWN_H + gap : 0) - 60)))
    : Math.round(Math.max(70, Math.min(440, chartLeftover)));

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: heroFont, fontWeight: 700, lineHeight: 1, color: level?.color ?? PALETTE.stress }}>
        {data.stress != null ? data.stress : '--'}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        Avg stress{level ? ` · ${level.label}` : ''}{data.maxStress != null ? ` · high ${data.maxStress}` : ''}
      </div>
      {data.stressQualifier && (
        <div style={{ fontSize: 14, opacity: 0.75 }}>{sentencePhrase(data.stressQualifier)}</div>
      )}
    </div>
  );

  const breakdown = showBreakdown && data.stressBreakdown && (
    <StressBreakdownBlock data={data} />
  );

  const chart = showChart && (
    <div style={{ width: wide ? chartWidth : '100%' }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Today</div>
      <Sparkline points={data.stressCurve} width={chartWidth} height={chartHeight} color={PALETTE.stress} />
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: chartWidth }}>
          {chart}
          {breakdown}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center',
      justifyContent: 'center', gap,
    }}>
      {hero}
      {breakdown}
      {chart}
    </div>
  );
}

/** Time-in-level stacked bar + 2×2 legend with durations, sleep-stage style. */
function StressBreakdownBlock({ data }: { data: GarminData }) {
  const b = data.stressBreakdown;
  if (!b) return null;
  const seconds: Record<(typeof LEVELS)[number]['key'], number> = {
    rest: b.rest, low: b.low, medium: b.medium, high: b.high,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <StackedBar segments={LEVELS.map((l) => [seconds[l.key], l.color])} height={20} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {LEVELS.map((l) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ opacity: 0.7 }}>{l.label}</span>
            <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(seconds[l.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
