import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { BandLineChart } from '../charts';
import { useHeartRate } from '../hooks';
import { isWide, stackGap } from '../size';
import { clamp, useScale } from '../scale';

/** Resting HR + 7d average always; today's HR line and min/max tiles appear
 *  as soon as the measured height fits them, and the chart grows with the
 *  box. Wide-short boxes get side-by-side panes (hero left, chart + tiles
 *  right). */
export function HeartRateView({ timezone, width, height, refreshMs }: ViewProps) {
  const u = useScale();
  const load = useHeartRate(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your heart rate..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load heart rate data." />;
  }
  const hr = load.data;
  if (!hr) {
    return (
      <EmptyState
        title="No heart rate yet"
        body="Your watch hasn't reported heart rate today. Give it a moment after syncing."
      />
    );
  }

  const wide = isWide(width, height);
  const gap = stackGap(height);
  // Height budget: hero + tiles are fixed-ish; the chart absorbs the rest.
  const heroFont = height >= 500 ? u(76) : u(64);
  const heroH = heroFont + u(30);
  // Scaled: what has to fit is the scaled tile row, so the threshold moves
  // with it. Left fixed, the gate admits four tiles onto a box the type has
  // already filled.
  const showMinMax = wide || height >= u(340);
  const tiles: [string, number | null][] = showMinMax
    ? [['Resting', hr.resting], ['7d average', hr.sevenDayAvg], ['Low', hr.min], ['High', hr.max]]
    : [['Resting', hr.resting], ['7d average', hr.sevenDayAvg]];
  const tilesH = u(50) + gap;
  const chartLeftover = height - heroH - tilesH - gap - u(18) - u(12);
  const showChart = hr.curve.length >= 2 && (wide || chartLeftover >= u(70));
  const chartWidth = wide ? Math.min(width * 0.45, u(480)) : Math.min(width, u(640));
  const chartHeight = wide
    ? Math.round(clamp(height - u(200), u(70), u(360)))
    : Math.round(clamp(chartLeftover, u(70), u(440)));

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u(4) }}>
      <div style={{ fontSize: heroFont, fontWeight: 700, lineHeight: 1, color: PALETTE.heart }}>
        {hr.resting != null ? hr.resting : '--'}
        <span style={{ fontSize: u(22), opacity: 0.7, marginLeft: u(6) }}>bpm</span>
      </div>
      <div style={{ fontSize: u(13), opacity: 0.6 }}>Resting heart rate</div>
    </div>
  );

  const chart = showChart && (
    <div>
      <div style={{ fontSize: u(12), opacity: 0.6, marginBottom: u(6) }}>Today</div>
      <BandLineChart
        points={hr.curve} width={chartWidth} height={chartHeight}
        color={PALETTE.heart}
      />
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: u(80) }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(20), width: chartWidth }}>
          {chart}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${u(18)}px ${u(48)}px` }}>
            {tiles.map(([label, value]) => (
              <StatTile key={label} label={label} value={value != null ? String(value) : '--'} unit="bpm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center',
      justifyContent: 'center', gap: stackGap(height),
    }}>
      {hero}
      {chart}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`,
        gap: `${u(22)}px ${u(32)}px`, width: '100%', maxWidth: u(640),
      }}>
        {tiles.map(([label, value]) => (
          <StatTile key={label} label={label} value={value != null ? String(value) : '--'} unit="bpm" align="center" />
        ))}
      </div>
    </div>
  );
}
