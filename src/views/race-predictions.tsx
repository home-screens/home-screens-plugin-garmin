import React from 'react';
import type { RacePredictions, Units, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState } from '../components';
import { useRacePredictions } from '../hooks';
import { isWide } from '../size';
import { formatPace, formatRaceTime } from '../format';

const DISTANCES: [keyof RacePredictions, string, number][] = [
  ['fiveK', '5K', 5_000],
  ['tenK', '10K', 10_000],
  ['half', 'Half marathon', 21_097.5],
  ['marathon', 'Marathon', 42_195],
];

/** Predicted finish times as a grid of big clocks (2×2, or one row on a
 *  wide-short box), each with its implied pace on medium+ heights. The
 *  watch predicts all four together, but any distance can be null early on
 *  and absent distances are skipped rather than shown as "--". */
export function RacePredictionsView({ timezone, units, width, height, refreshMs }: ViewProps) {
  const load = useRacePredictions(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your race predictions..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load race predictions." />;
  }
  const p = load.data;
  const rows = p ? DISTANCES.filter(([key]) => p[key] != null) : [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No race predictions yet"
        body="Your watch predicts race times after a few runs with heart rate. Most newer Garmin watches support this."
      />
    );
  }

  const wide = isWide(width, height);
  // One row of columns on a wide box, a 2×2 grid on squarish boxes, a single
  // big-type column on portrait boxes; rows distribute over the full height.
  const columns = wide ? rows.length : width >= height ? Math.min(2, rows.length) : 1;
  const rowCount = Math.ceil(rows.length / columns);
  const showPace = height >= 340 || wide;
  // Longest time string ("1:50:03" ≈ 4.4 characters of width at tabular
  // sizing) bounds the font so columns never collide; the per-row height
  // budget (label ~17 + pace ~22 + breathing room) bounds it vertically.
  const colWidth = (wide ? width * 0.9 : width) / columns;
  const perRow = (height - 16) / rowCount;
  const timeFont = Math.round(Math.max(30, Math.min(
    colWidth / 4.4,
    perRow - 45 - (showPace ? 22 : 0),
    72,
  )));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`,
        flex: 1, alignContent: 'space-evenly', columnGap: 40, rowGap: 12,
        width: '100%',
      }}>
        {rows.map(([key, label, meters]) => {
          const seconds = p![key] as number;
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 13, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </div>
              <div style={{
                fontSize: timeFont, fontWeight: 700, lineHeight: 1.05,
                color: PALETTE.steps, fontVariantNumeric: 'tabular-nums',
              }}>
                {formatRaceTime(seconds)}
              </div>
              {showPace && <PaceLine seconds={seconds} meters={meters} units={units} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaceLine({ seconds, meters, units }: { seconds: number; meters: number; units: Units }) {
  return (
    <div style={{ fontSize: 14, opacity: 0.65 }}>
      {formatPace(meters / seconds, units)}
    </div>
  );
}
