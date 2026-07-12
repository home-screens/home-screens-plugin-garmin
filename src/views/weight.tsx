import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { BandLineChart } from '../charts';
import { useWeight } from '../hooks';
import { isWide, stackGap } from '../size';
import { formatWeight, formatWeightDelta } from '../format';

/** A calm blue — weight up or down carries no built-in "good/bad", so the
 *  view never colors the change red or green. */
const WEIGHT_COLOR = PALETTE.steps;

/** Current weight + change vs the last weigh-in always; BMI and a past-4-weeks
 *  tile appear when the height fits them, and the 4-week trend line absorbs the
 *  leftover height. Wide-short boxes get side-by-side panes (hero left, tiles +
 *  trend right). Opt-in view only — weight is never published to shared state. */
export function WeightView({ units, timezone, width, height, refreshMs }: ViewProps) {
  const load = useWeight(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your weight..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load weight data." />;
  }
  const w = load.data;
  if (!w) {
    return (
      <EmptyState
        title="No weight entries yet"
        body="Weigh in with a Garmin scale or log it in the Connect app to see your weight here."
      />
    );
  }

  const wide = isWide(width, height);
  const gap = stackGap(height);
  // Height budget: hero + tiles are fixed-ish; the trend chart absorbs the rest.
  const heroFont = height >= 500 ? 76 : 64;
  const heroH = heroFont + 44;
  const showTiles = wide || height >= 340;

  const deltaStr = w.changeKg != null ? formatWeightDelta(w.changeKg, units) : null;
  const changeCaption = deltaStr == null
    ? 'Your latest weigh-in'
    : deltaStr[0] === '+' || deltaStr[0] === '-'
      ? `${deltaStr} since last weigh-in`
      : 'No change since last weigh-in';

  const tiles: [string, string][] = [];
  if (w.bmi != null) tiles.push(['BMI', w.bmi.toFixed(1)]);
  if (w.trend.length >= 2) {
    tiles.push(['Past 4 weeks', formatWeightDelta(w.weightKg - w.trend[0].kg, units)]);
  }

  const tilesH = showTiles && tiles.length > 0 ? 50 + gap : 0;
  const trendLeftover = height - heroH - tilesH - gap - 18 - 12;
  const showTrend = w.trend.length >= 2 && (wide || trendLeftover >= 80);
  const chartWidth = wide ? Math.min(width * 0.45, 480) : Math.min(width, 640);
  const trendHeight = wide
    ? Math.round(Math.max(80, Math.min(340, height - 200)))
    : Math.round(Math.max(80, Math.min(440, trendLeftover)));

  const [heroValue, heroUnit] = formatWeight(w.weightKg, units).split(' ');
  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: heroFont, fontWeight: 700, lineHeight: 1, color: WEIGHT_COLOR }}>
        {heroValue}
        <span style={{ fontSize: 24, opacity: 0.6, marginLeft: 8 }}>{heroUnit}</span>
      </div>
      <div style={{ fontSize: 14, opacity: 0.6 }}>{changeCaption}</div>
    </div>
  );

  const trend = showTrend && (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Last 4 weeks</div>
      <BandLineChart
        points={w.trend.map((p, i) => ({ t: i, v: p.kg }))}
        width={chartWidth} height={trendHeight} color={WEIGHT_COLOR}
      />
    </div>
  );

  const tileRow = (align: 'left' | 'center') => (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`,
      gap: '22px 48px', width: '100%', maxWidth: 520,
    }}>
      {tiles.map(([label, value]) => (
        <StatTile key={label} label={label} value={value} align={align} />
      ))}
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: chartWidth }}>
          {trend}
          {tiles.length > 0 && tileRow('left')}
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
      {showTiles && tiles.length > 0 && tileRow('center')}
      {trend}
    </div>
  );
}
