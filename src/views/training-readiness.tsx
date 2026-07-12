import React from 'react';
import type { TrainingReadiness, ViewProps } from '../types';
import { EmptyState, Ring, StatTile } from '../components';
import { useTrainingReadiness } from '../hooks';
import { isWide, stackGap } from '../size';
import { formatDuration, sentencePhrase } from '../format';

/** Garmin's own level colors (fēnix 7 manual): Prime purple, High blue,
 *  Moderate green, Low orange, Poor red. */
const LEVEL: Record<string, { label: string; color: string }> = {
  PRIME: { label: 'Prime', color: '#a855f7' },
  HIGH: { label: 'High', color: '#3b82f6' },
  MODERATE: { label: 'Moderate', color: '#22c55e' },
  LOW: { label: 'Low', color: '#f97316' },
  POOR: { label: 'Poor', color: '#ef4444' },
};

const QUALITY_COLOR: Record<string, string> = {
  VERY_GOOD: '#22c55e', GOOD: '#22c55e', MODERATE: '#f59e0b',
  POOR: '#ef4444', VERY_POOR: '#ef4444',
};

/** Score ring + level + coach line; factor tiles (4, then all 6) appear when
 *  the height budget fits them, and the ring absorbs the leftover height so
 *  the box fills instead of accruing dead bands. Wide-short boxes get
 *  side-by-side panes (ring left, factors right) instead of the stack. */
export function TrainingReadinessView({ timezone, width, height, refreshMs }: ViewProps) {
  const load = useTrainingReadiness(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your training readiness..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load training readiness." />;
  }
  const r = load.data;
  if (!r) {
    return (
      <EmptyState
        title="No readiness score yet"
        body="Your watch hasn't reported training readiness today. Most newer Garmin watches measure it while you sleep."
      />
    );
  }

  const level = LEVEL[r.level] ?? LEVEL.MODERATE;
  const wide = isWide(width, height);
  const gap = stackGap(height);

  // Height budget: estimate the non-ring pieces (SLACK covers the hero's
  // internal gap and line-height rounding), give the ring the rest.
  const TILE_ROW = 50, TILE_GAP = 22, MIN_RING = 150, SLACK = 16;
  const feedbackH = r.feedback ? 30 : 0;
  const rowsH = (n: number) => (n === 0 ? 0 : Math.ceil(n / 2) * TILE_ROW + (Math.ceil(n / 2) - 1) * TILE_GAP + gap);
  const fits = (n: number) => MIN_RING + feedbackH + rowsH(n) + SLACK <= height;
  const tileCount = wide ? (height >= 300 ? 6 : 4) : fits(6) ? 6 : fits(4) ? 4 : 0;
  const tiles = tileCount > 0 ? factorTiles(r, tileCount === 6) : [];
  const ringSize = wide
    ? Math.round(Math.min(360, Math.max(150, height - feedbackH - 8)))
    : Math.round(Math.min(Math.min(440, width * 0.72), Math.max(140, height - feedbackH - rowsH(tiles.length) - SLACK)));

  const hero = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Ring
        ratio={r.score / 100} size={ringSize} stroke={18} color={level.color}
        label={String(r.score)} sub={level.label}
      />
      {r.feedback && (
        <div style={{ fontSize: 14, opacity: 0.75, textAlign: 'center' }}>
          {sentencePhrase(r.feedback)}
        </div>
      )}
    </div>
  );

  if (wide && tiles.length > 0) {
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
      justifyContent: 'center', gap: stackGap(height),
    }}>
      {hero}
      {tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 32px', width: '100%', maxWidth: 520 }}>
          {tiles.map(([label, value, unit, color]) => (
            <StatTile key={label} label={label} value={value} unit={unit} color={color} align="center" />
          ))}
        </div>
      )}
    </div>
  );
}

/** [label, quality word, detail, color] per factor; factors the watch didn't
 *  report are skipped rather than shown as "--". */
function factorTiles(
  r: TrainingReadiness, extended: boolean,
): [string, string, string | undefined, string | undefined][] {
  const tile = (
    label: string, feedback: string | null, detail?: string,
  ): [string, string, string | undefined, string | undefined] | null =>
    feedback == null ? null : [
      label, sentencePhrase(feedback) as string, detail, QUALITY_COLOR[feedback],
    ];

  const rows = [
    tile('Sleep', r.sleepFeedback, r.sleepScore != null ? String(r.sleepScore) : undefined),
    tile('HRV', r.hrvFeedback, r.hrvWeeklyAverage != null ? `${r.hrvWeeklyAverage} ms` : undefined),
    tile('Recovery', r.recoveryFeedback,
      r.recoveryMinutes != null && r.recoveryMinutes > 0 ? formatDuration(r.recoveryMinutes * 60) : undefined),
    tile('Acute load', r.loadFeedback, r.acuteLoad != null ? String(r.acuteLoad) : undefined),
  ];
  if (extended) {
    rows.push(tile('Recent sleep', r.sleepHistoryFeedback), tile('Recent stress', r.stressHistoryFeedback));
  }
  return rows.filter((t): t is NonNullable<typeof t> => t != null);
}
