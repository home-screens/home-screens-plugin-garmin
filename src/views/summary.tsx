import React from 'react';
import type { GarminData, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Ring, Sparkline, StatTile } from '../components';
import { formatCount, formatDistance } from '../format';
import { useStepsStreak, useWeeklyIntensity } from '../hooks';
import { isWide, stackGap } from '../size';

/** Steps ring (with concentric intensity ring) + stat tiles; the tile count
 *  (4 or 6) comes from the height budget, the ring absorbs the leftover, and
 *  any remaining height becomes the Body Battery sparkline. Wide-short boxes
 *  get side-by-side panes (ring left, tiles right). */
export function SummaryView({ data, units, timezone, width, height, refreshMs }: ViewProps) {
  const stepRatio = data.steps != null && data.stepGoal ? data.steps / data.stepGoal : 0;
  // The intensity goal is WEEKLY, so the inner ring compares this week's
  // minutes against it. Until (or unless) that fetch lands, fall back to
  // today's minutes with no goal comparison.
  const imLoad = useWeeklyIntensity(timezone, refreshMs);
  const weeklyIm = imLoad.status === 'ready' ? imLoad.data : null;
  const streakLoad = useStepsStreak(timezone, refreshMs);
  const streak = streakLoad.status === 'ready' ? streakLoad.data : null;
  const intensityRatio = weeklyIm?.goal ? weeklyIm.minutes / weeklyIm.goal : 0;
  const intensityLine = weeklyIm
    ? `Intensity ${weeklyIm.minutes}${weeklyIm.goal ? ` of ${weeklyIm.goal} min` : ' min'} this week`
    : data.intensityMinutes != null
      ? `Intensity today · ${data.intensityMinutes} min`
      : null;
  const wide = isWide(width, height);
  const gap = stackGap(height);

  // Height budget: tiles first, ring absorbs the leftover (up to its cap),
  // any remainder becomes the sparkline.
  const TILE_ROW = 50, TILE_GAP = 22, MIN_RING = 140, SLACK = 16;
  const heroExtra = (intensityLine ? 24 : 0)
    + (data.distanceMeters != null ? 24 : 0);
  const rowsH = (n: number) => Math.ceil(n / 2) * TILE_ROW + (Math.ceil(n / 2) - 1) * TILE_GAP + gap;
  const fits = (n: number) => MIN_RING + heroExtra + rowsH(n) + SLACK <= height;
  const tileCount = wide ? 6 : fits(6) ? 6 : fits(4) ? 4 : 0;
  const tiles = statTiles(data, tileCount, streak);

  const ringAvail = height - heroExtra - (tiles.length ? rowsH(tiles.length) : 0) - SLACK;
  const ringSize = wide
    ? Math.round(Math.min(340, Math.max(150, height - heroExtra - 8)))
    : Math.round(Math.min(Math.min(400, width * 0.72), Math.max(MIN_RING, ringAvail)));
  const sparkAvail = ringAvail - ringSize - gap - 18;
  const sparkH = Math.round(Math.max(80, Math.min(220, sparkAvail)));
  const showSpark = !wide && data.bodyBatteryCurve.length >= 2 && sparkAvail >= 90;

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <Ring
        ratio={stepRatio} size={ringSize} stroke={18} color={PALETTE.steps}
        label={formatCount(data.steps)}
        sub={data.stepGoal ? `of ${formatCount(data.stepGoal)}` : 'steps'}
        inner={weeklyIm ? { ratio: intensityRatio, color: PALETTE.stress } : undefined}
      />
      {intensityLine && (
        <div style={{ fontSize: 12, opacity: 0.65 }}>{intensityLine}</div>
      )}
      {data.distanceMeters != null && (
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          Distance today · {formatDistance(data.distanceMeters, units)}
        </div>
      )}
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {hero}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 48px' }}>
          {tiles.map(([label, value, unit, color]) => (
            <StatTile key={label} label={label} value={value} unit={unit} color={color} />
          ))}
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
      {tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 32px', width: '100%', maxWidth: 520 }}>
          {tiles.map(([label, value, unit, color]) => (
            <StatTile key={label} label={label} value={value} unit={unit} color={color} align="center" />
          ))}
        </div>
      )}
      {showSpark && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Body Battery today</div>
          <Sparkline points={data.bodyBatteryCurve} width={width} height={sparkH} color={PALETTE.bodyBattery} />
        </div>
      )}
    </div>
  );
}

function statTiles(
  data: GarminData, count: number, streak: number | null,
): [string, string, string | undefined, string][] {
  const tiles: [string, string, string | undefined, string][] = [
    ['Body Battery', data.bodyBattery != null ? String(data.bodyBattery) : '--', undefined, PALETTE.bodyBattery],
    ['Resting HR', data.restingHr != null ? String(data.restingHr) : '--', 'bpm', PALETTE.heart],
    ['Stress', data.stress != null ? String(data.stress) : '--', undefined, PALETTE.stress],
    ['Sleep score', data.sleepScore != null ? String(data.sleepScore) : '--', undefined, PALETTE.sleepLight],
    ['Calories', data.activeCalories != null ? formatCount(data.activeCalories) : formatCount(data.calories), undefined, PALETTE.stress],
    ['Floors', data.floorsAscended != null ? String(data.floorsAscended) : '--', undefined, PALETTE.steps],
  ];
  // A current step-goal streak is a better motivator than Floors (often 0), so
  // it takes the 6th slot when there is one worth showing. A "1" isn't a streak.
  if (streak != null && streak >= 2) {
    tiles[5] = ['Streak', String(streak), 'days', PALETTE.steps];
  }
  return tiles.slice(0, count);
}
