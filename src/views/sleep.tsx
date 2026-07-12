import React from 'react';
import type { GarminData, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Ring, StackedBar, StatTile } from '../components';
import { formatClock, formatDuration } from '../format';
import { isWide, stackGap } from '../size';

/** Score ring (total sleep time in the center) + the stage breakdown (bar +
 *  legend) always; the HRV/restless/battery tiles appear when the height
 *  budget fits them, and the ring absorbs the leftover height so the box fills
 *  instead of accruing dead bands. Wide-short boxes get side-by-side panes
 *  (ring left, stage detail right). */
export function SleepView({ data, timezone, width, height }: ViewProps) {
  const wide = isWide(width, height);
  const gap = stackGap(height);

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

  // Ring fill: sleep score when the watch scored the night, else total time
  // against a nominal 8h so the ring still reads as "how much sleep".
  const score = data.sleepScore;
  const ratio = score != null
    ? score / 100
    : data.sleepTotalSeconds ? Math.min(1, data.sleepTotalSeconds / 28_800) : 0;

  // Height budget: the stage block (bar ~22 + legend ~46), one tile row ~50,
  // and the bed/wake line ~20 are estimated with slack; the ring takes the
  // rest. Tiles drop first when the box is too short.
  const STAGE_H = 80, TILE_ROW = 50, BEDWAKE_H = 20, MIN_RING = 130, SLACK = 16;
  const nGaps = (n: boolean) => (n ? 3 : 2);
  const fitsTiles = MIN_RING + STAGE_H + TILE_ROW + BEDWAKE_H + SLACK
    + nGaps(true) * gap <= height;
  const showTiles = wide || fitsTiles;

  const ringSize = wide
    ? Math.round(Math.min(360, Math.max(MIN_RING, height - 8)))
    : Math.round(Math.min(
        Math.min(460, width * 0.75),
        Math.max(MIN_RING,
          height - STAGE_H - (showTiles ? TILE_ROW : 0) - BEDWAKE_H - SLACK - nGaps(showTiles) * gap),
      ));

  const hero = (
    <Ring
      ratio={ratio} size={ringSize} stroke={18} color={PALETTE.sleepLight}
      label={formatDuration(data.sleepTotalSeconds)}
      sub={score != null ? `score ${score}` : 'asleep'}
    />
  );

  const stageBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
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
    </div>
  );

  const tiles = showTiles ? <div style={{ width: '100%' }}>{statTiles(data)}</div> : null;
  const bedWake = (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 14, opacity: 0.7 }}>
      <span>Bed {formatClock(data.sleepStart, timezone)}</span>
      <span>Wake {formatClock(data.sleepEnd, timezone)}</span>
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
        {hero}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, maxWidth: 460 }}>
          {stageBlock}
          {tiles}
          {bedWake}
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
      {stageBlock}
      {tiles}
      {bedWake}
    </div>
  );
}

function statTiles(data: GarminData) {
  const change = data.sleepBodyBatteryChange;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
      <StatTile label="HRV" value={data.hrv != null ? String(data.hrv) : '--'} unit={data.hrv != null ? 'ms' : undefined} color={PALETTE.sleepRem} align="center" />
      <StatTile label="Restless" value={data.restlessMoments != null ? String(data.restlessMoments) : '--'} color={PALETTE.awake} align="center" />
      <StatTile
        label="Battery change"
        value={change != null ? `${change >= 0 ? '+' : ''}${change}` : '--'}
        color={change != null && change < 0 ? PALETTE.stress : PALETTE.bodyBattery}
        align="center"
      />
    </div>
  );
}
