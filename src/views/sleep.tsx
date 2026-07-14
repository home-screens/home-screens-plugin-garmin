import React from 'react';
import type { GarminData, Units, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { Ring, StackedBar, StatTile } from '../components';
import { formatClock, formatDuration } from '../format';
import { isWide, stackGap } from '../size';

/** Score ring (total sleep time in the center) + the stage breakdown (bar +
 *  legend) always; the HRV/restless/battery tiles appear when the height
 *  budget fits them (a second row of SpO2/respiration/sleep-need tiles when
 *  the watch reports them and the box is taller still), and the ring absorbs
 *  the leftover height so the box fills instead of accruing dead bands.
 *  Wide-short boxes get side-by-side panes (ring left, stage detail right). */
export function SleepView({ data, units, timezone, width, height }: ViewProps) {
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

  // Height budget: the stage block (bar ~22 + legend ~46), each tile row ~50,
  // and the bed/wake line ~20 are estimated with slack; the ring takes the
  // rest. The extras row (SpO2/respiration/need) drops first, then the core
  // tiles, when the box is too short.
  const STAGE_H = 80, TILE_ROW = 50, TILE_ROW_GAP = 18, BEDWAKE_H = 20, MIN_RING = 130, SLACK = 16;
  const extras = extraTiles(data, units);
  const tileRowsH = (rows: number) => (rows === 0 ? 0 : rows * TILE_ROW + (rows - 1) * TILE_ROW_GAP);
  const nGaps = (rows: number) => (rows > 0 ? 3 : 2);
  const fits = (rows: number) => MIN_RING + STAGE_H + tileRowsH(rows) + BEDWAKE_H + SLACK
    + nGaps(rows) * gap <= height;
  const tileRowCount = wide
    ? (extras.length > 0 && height >= 320 ? 2 : 1)
    : extras.length > 0 && fits(2) ? 2 : fits(1) ? 1 : 0;
  const showTiles = wide || tileRowCount > 0;

  const ringSize = wide
    ? Math.round(Math.min(360, Math.max(MIN_RING, height - 8)))
    : Math.round(Math.min(
        Math.min(460, width * 0.75),
        Math.max(MIN_RING,
          height - STAGE_H - tileRowsH(tileRowCount) - BEDWAKE_H - SLACK - nGaps(tileRowCount) * gap),
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

  const tiles = showTiles ? (
    <div style={{
      width: '100%', display: 'flex', flexDirection: 'column', gap: TILE_ROW_GAP,
    }}>
      {statTiles(data)}
      {tileRowCount >= 2 && extras.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${extras.length}, 1fr)`, gap: 18 }}>
          {extras.map(([label, value, unit]) => (
            <StatTile key={label} label={label} value={value} unit={unit} color={PALETTE.sleepDeep} align="center" />
          ))}
        </div>
      )}
    </div>
  ) : null;
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

/** [label, value, unit] for the extras row — only metrics the watch actually
 *  reported (SpO2 is off by default on many watches), capped at three so the
 *  row matches the core-tiles grid. Skin temp fills the third slot only when
 *  sleep need is absent. */
function extraTiles(data: GarminData, units: Units): [string, string, string | undefined][] {
  const rows: [string, string, string | undefined][] = [];
  if (data.sleepSpo2 != null) rows.push(['SpO2', String(Math.round(data.sleepSpo2)), '%']);
  if (data.sleepRespiration != null) {
    rows.push(['Respiration', String(Math.round(data.sleepRespiration)), 'brpm']);
  }
  if (data.sleepNeedMinutes != null && data.sleepNeedMinutes > 0) {
    rows.push(['Sleep need', formatDuration(data.sleepNeedMinutes * 60), undefined]);
  } else if (data.skinTempDeviationC != null) {
    const v = units === 'imperial' ? data.skinTempDeviationC * 1.8 : data.skinTempDeviationC;
    rows.push(['Skin temp', `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`, undefined]);
  }
  return rows.slice(0, 3);
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
