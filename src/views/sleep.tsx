import React from 'react';
import type { ViewProps } from '../types';
import { PALETTE } from '../theme';
import { StackedBar, StatTile } from '../components';
import { formatClock, formatDuration } from '../format';

export function SleepView({ data, timezone, tier }: ViewProps) {
  const segments: [number, string][] = [
    [data.sleepDeep ?? 0, PALETTE.sleepDeep],
    [data.sleepLight ?? 0, PALETTE.sleepLight],
    [data.sleepRem ?? 0, PALETTE.sleepRem],
    [data.sleepAwake ?? 0, PALETTE.awake],
  ];
  const legend: [string, string, number | null][] = [
    ['Deep', PALETTE.sleepDeep, data.sleepDeep],
    ['Light', PALETTE.sleepLight, data.sleepLight],
    ['REM', PALETTE.sleepRem, data.sleepRem],
    ['Awake', PALETTE.awake, data.sleepAwake],
  ];
  const change = data.sleepBodyBatteryChange;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 44, fontWeight: 700 }}>{formatDuration(data.sleepTotalSeconds)}</div>
        {data.sleepScore != null && (
          <div style={{ fontSize: 16, opacity: 0.7 }}>score {data.sleepScore}</div>
        )}
      </div>
      <StackedBar segments={segments} height={22} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {legend.map(([name, color, secs]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ opacity: 0.7 }}>{name}</span>
            <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(secs)}</span>
          </div>
        ))}
      </div>
      {tier !== 'compact' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <StatTile label="HRV" value={data.hrv != null ? String(data.hrv) : '--'} unit={data.hrv != null ? 'ms' : undefined} color={PALETTE.sleepRem} />
          <StatTile label="Restless" value={data.restlessMoments != null ? String(data.restlessMoments) : '--'} color={PALETTE.awake} />
          <StatTile
            label="Battery change"
            value={change != null ? `${change >= 0 ? '+' : ''}${change}` : '--'}
            color={change != null && change < 0 ? PALETTE.stress : PALETTE.bodyBattery}
          />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 14, opacity: 0.7 }}>
        <span>Bed {formatClock(data.sleepStart, timezone)}</span>
        <span>Wake {formatClock(data.sleepEnd, timezone)}</span>
      </div>
    </div>
  );
}
