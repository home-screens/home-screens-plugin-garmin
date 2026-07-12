import React from 'react';
import type { ViewProps } from '../types';
import { EmptyState, MarkerBar, StatTile } from '../components';
import { BandLineChart } from '../charts';
import { useHrvStatus } from '../hooks';
import { isWide, stackGap } from '../size';
import { sentencePhrase } from '../format';

const STATUS_COLOR: Record<string, string> = {
  BALANCED: '#22c55e', UNBALANCED: '#f59e0b', LOW: '#ef4444', POOR: '#ef4444',
};

/** Last-night HRV + status word; the balanced-range bar, tiles, and 4-week
 *  trend appear as soon as the measured height fits them. Wide-short boxes
 *  get side-by-side panes (hero left, bar + trend + tiles right). */
export function HrvView({ timezone, width, height, refreshMs }: ViewProps) {
  const load = useHrvStatus(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your HRV data..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load HRV data." />;
  }
  const h = load.data;
  if (!h) {
    return (
      <EmptyState
        title="No HRV data yet"
        body="Wear your watch to sleep and it will start tracking your heart rate variability overnight."
      />
    );
  }

  const statusColor = h.status ? STATUS_COLOR[h.status] ?? 'inherit' : 'inherit';
  const hasBand = h.balancedLow != null && h.balancedUpper != null;
  const wide = isWide(width, height);
  const chartWidth = wide ? Math.min(width * 0.4, 420) : Math.min(width, 640);
  // Height budget: hero + band + tiles are fixed-ish; the trend chart
  // absorbs the rest.
  const gap = stackGap(height);
  const heroH = (height >= 500 ? 76 : 64) + 50;
  const showBand = hasBand && h.lastNight != null && (wide || height >= 340);
  const showTiles = wide || height >= 420;
  const bandH = showBand ? 50 + gap : 0;
  const tilesH = showTiles ? 50 + gap : 0;
  const trendLeftover = height - heroH - bandH - tilesH - gap - 18 - 12;
  const showTrend = h.trend.length >= 2 && (wide || trendLeftover >= 80);
  const trendHeight = wide
    ? Math.round(Math.max(80, Math.min(300, height - 200)))
    : Math.round(Math.max(80, Math.min(360, trendLeftover)));

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: height >= 500 ? 76 : 64, fontWeight: 700, lineHeight: 1 }}>
        {h.lastNight != null ? h.lastNight : '--'}
        <span style={{ fontSize: 22, opacity: 0.6, marginLeft: 6 }}>ms</span>
      </div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>Last night's HRV</div>
      {h.status && (
        <div style={{ fontSize: 20, fontWeight: 600, color: statusColor, marginTop: 4 }}>
          {sentencePhrase(h.status)}
        </div>
      )}
    </div>
  );

  const band = showBand && h.lastNight != null && (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
        Balanced range · {h.balancedLow}–{h.balancedUpper} ms
      </div>
      <MarkerBar
        value={h.lastNight} bandLow={h.balancedLow as number} bandHigh={h.balancedUpper as number}
        max={Math.max((h.balancedUpper as number) * 1.4, h.lastNight * 1.15)} width={chartWidth}
      />
    </div>
  );

  const trend = showTrend && (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Last 4 weeks</div>
      <BandLineChart
        points={h.trend.map((p, i) => ({ t: i, v: p.v }))}
        width={chartWidth} height={trendHeight} color="#a855f7"
        band={hasBand ? { low: h.balancedLow as number, high: h.balancedUpper as number } : undefined}
      />
    </div>
  );

  const tiles = (align: 'left' | 'center') => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 32px', width: '100%', maxWidth: 520 }}>
      {h.weeklyAvg != null && <StatTile label="7d average" value={String(h.weeklyAvg)} unit="ms" align={align} />}
      {h.lastNight5MinHigh != null && <StatTile label="Overnight high" value={String(h.lastNight5MinHigh)} unit="ms" align={align} />}
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: chartWidth }}>
          {band}
          {trend}
          {tiles('left')}
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
      {band}
      {trend}
      {showTiles && tiles('center')}
    </div>
  );
}
