import React from 'react';
import type { GarminData, Units } from './types';
import { PALETTE } from './theme';
import { Ring, Gauge, StackedBar, Sparkline, StatTile } from './components';
import { formatCount, formatDuration, formatDistance, formatClock, activityLabel } from './format';

interface ViewProps {
  data: GarminData;
  units: Units;
  timezone: string;
  activityCount: number;
}

export function SummaryView({ data }: ViewProps) {
  const ratio = data.steps != null && data.stepGoal ? data.steps / data.stepGoal : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
        <Ring
          ratio={ratio} size={190} stroke={18} color={PALETTE.steps}
          label={formatCount(data.steps)} sub={data.stepGoal ? `of ${formatCount(data.stepGoal)}` : 'steps'}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 'auto' }}>
        <StatTile label="Body Battery" value={data.bodyBattery != null ? String(data.bodyBattery) : '--'} color={PALETTE.bodyBattery} />
        <StatTile label="Resting HR" value={data.restingHr != null ? String(data.restingHr) : '--'} unit="bpm" color={PALETTE.heart} />
        <StatTile label="Stress" value={data.stress != null ? String(data.stress) : '--'} color={PALETTE.stress} />
        <StatTile label="Sleep score" value={data.sleepScore != null ? String(data.sleepScore) : '--'} color={PALETTE.sleepLight} />
      </div>
    </div>
  );
}

export function BodyBatteryView({ data }: ViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, alignItems: 'center' }}>
      <Gauge value={data.bodyBattery ?? 0} size={220} color={PALETTE.bodyBattery} />
      <div style={{ display: 'flex', gap: 28 }}>
        <StatTile label="Charged" value={data.bodyBatteryCharged != null ? `+${data.bodyBatteryCharged}` : '--'} color={PALETTE.bodyBattery} />
        <StatTile label="Drained" value={data.bodyBatteryDrained != null ? `-${data.bodyBatteryDrained}` : '--'} color={PALETTE.stress} />
      </div>
      <div style={{ width: '100%', marginTop: 'auto' }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Today</div>
        <Sparkline points={data.bodyBatteryCurve} width={440} height={90} color={PALETTE.bodyBattery} />
      </div>
    </div>
  );
}

export function SleepView({ data, timezone }: ViewProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 14, opacity: 0.7 }}>
        <span>Bed {formatClock(data.sleepStart, timezone)}</span>
        <span>Wake {formatClock(data.sleepEnd, timezone)}</span>
      </div>
    </div>
  );
}

export function ActivitiesView({ data, units, activityCount }: ViewProps) {
  const rows = data.activities.slice(0, activityCount);
  if (rows.length === 0) {
    return <div style={{ opacity: 0.5, textAlign: 'center', paddingTop: 40 }}>No recent activities</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((a) => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
          borderBottom: `1px solid ${PALETTE.rail}`,
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, background: PALETTE.rail,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
            flexShrink: 0,
          }}>{activityLabel(a.typeKey).slice(0, 3)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{activityLabel(a.typeKey)}</div>
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontWeight: 600 }}>{formatDistance(a.distanceMeters, units)}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {formatDuration(a.durationSeconds)}{a.averageHr ? ` · ${Math.round(a.averageHr)} bpm` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
