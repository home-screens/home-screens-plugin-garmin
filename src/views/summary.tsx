import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Ring, Sparkline, StatTile } from '../components';
import { formatCount, formatDistance } from '../format';

/** compact: v1 layout (steps ring + 2×2 tiles). medium: + concentric intensity
 *  ring, 6 tiles. large: + distance-today line + Body Battery day sparkline. */
export function SummaryView({ data, units, tier, width }: ViewProps) {
  const stepRatio = data.steps != null && data.stepGoal ? data.steps / data.stepGoal : 0;
  const intensityRatio =
    data.intensityMinutes != null && data.intensityMinutesGoal
      ? data.intensityMinutes / data.intensityMinutesGoal : 0;
  const ringSize = tier === 'large' ? 250 : tier === 'medium' ? 215 : 190;

  const tiles: [string, string, string | undefined, string][] = [
    ['Body Battery', data.bodyBattery != null ? String(data.bodyBattery) : '--', undefined, PALETTE.bodyBattery],
    ['Resting HR', data.restingHr != null ? String(data.restingHr) : '--', 'bpm', PALETTE.heart],
    ['Stress', data.stress != null ? String(data.stress) : '--', undefined, PALETTE.stress],
    ['Sleep score', data.sleepScore != null ? String(data.sleepScore) : '--', undefined, PALETTE.sleepLight],
  ];
  if (tier !== 'compact') {
    tiles.push(
      ['Calories', data.activeCalories != null ? formatCount(data.activeCalories) : formatCount(data.calories), undefined, PALETTE.stress],
      ['Floors', data.floorsAscended != null ? String(data.floorsAscended) : '--', undefined, PALETTE.steps],
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 6 }}>
        <Ring
          ratio={stepRatio} size={ringSize} stroke={18} color={PALETTE.steps}
          label={formatCount(data.steps)}
          sub={data.stepGoal ? `of ${formatCount(data.stepGoal)}` : 'steps'}
          inner={tier !== 'compact' ? { ratio: intensityRatio, color: PALETTE.stress } : undefined}
        />
        {tier !== 'compact' && data.intensityMinutes != null && (
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Intensity {data.intensityMinutes}
            {data.intensityMinutesGoal ? ` of ${data.intensityMinutesGoal} min` : ' min'}
          </div>
        )}
        {tier === 'large' && data.distanceMeters != null && (
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            Distance today · {formatDistance(data.distanceMeters, units)}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 'auto' }}>
        {tiles.map(([label, value, unit, color]) => (
          <StatTile key={label} label={label} value={value} unit={unit} color={color} />
        ))}
      </div>
      {tier === 'large' && (
        <div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Body Battery today</div>
          <Sparkline points={data.bodyBatteryCurve} width={width} height={80} color={PALETTE.bodyBattery} />
        </div>
      )}
    </div>
  );
}
