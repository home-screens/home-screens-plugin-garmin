import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { BandLineChart } from '../charts';
import { useHeartRate } from '../hooks';
import { isWide, stackGap } from '../size';

/** Resting HR + 7d average always; today's HR line and min/max tiles appear
 *  as soon as the measured height fits them, and the chart grows with the
 *  box. Wide-short boxes get side-by-side panes (hero left, chart + tiles
 *  right). */
export function HeartRateView({ timezone, width, height, refreshMs }: ViewProps) {
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
  const heroFont = height >= 500 ? 76 : 64;
  const heroH = heroFont + 30;
  const showMinMax = wide || height >= 340;
  const tiles: [string, number | null][] = showMinMax
    ? [['Resting', hr.resting], ['7d average', hr.sevenDayAvg], ['Low', hr.min], ['High', hr.max]]
    : [['Resting', hr.resting], ['7d average', hr.sevenDayAvg]];
  const tilesH = 50 + gap;
  const chartLeftover = height - heroH - tilesH - gap - 18 - 12;
  const showChart = hr.curve.length >= 2 && (wide || chartLeftover >= 70);
  const chartWidth = wide ? Math.min(width * 0.45, 480) : Math.min(width, 640);
  const chartHeight = wide
    ? Math.round(Math.max(70, Math.min(360, height - 200)))
    : Math.round(Math.max(70, Math.min(440, chartLeftover)));

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: heroFont, fontWeight: 700, lineHeight: 1, color: PALETTE.heart }}>
        {hr.resting != null ? hr.resting : '--'}
        <span style={{ fontSize: 22, opacity: 0.7, marginLeft: 6 }}>bpm</span>
      </div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>Resting heart rate</div>
    </div>
  );

  const chart = showChart && (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Today</div>
      <BandLineChart
        points={hr.curve} width={chartWidth} height={chartHeight}
        color={PALETTE.heart}
      />
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: chartWidth }}>
          {chart}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 48px' }}>
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
        gap: '22px 32px', width: '100%', maxWidth: 640,
      }}>
        {tiles.map(([label, value]) => (
          <StatTile key={label} label={label} value={value != null ? String(value) : '--'} unit="bpm" align="center" />
        ))}
      </div>
    </div>
  );
}
