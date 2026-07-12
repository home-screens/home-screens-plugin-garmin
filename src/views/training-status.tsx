import React from 'react';
import type { TrainingStatusInfo, ViewProps } from '../types';
import { EmptyState, MarkerBar, StatTile } from '../components';
import { useTrainingStatus } from '../hooks';
import { isWide, stackGap } from '../size';
import { formatShortDate, loadFocusLabel, sentencePhrase } from '../format';

const STATUS_COLOR: Record<string, string> = {
  PRODUCTIVE: '#22c55e', PEAKING: '#a855f7', MAINTAINING: '#f59e0b',
  RECOVERY: '#3b82f6', UNPRODUCTIVE: '#f97316', OVERREACHING: '#ef4444',
  STRAINED: '#ef4444', DETRAINING: '#64748b', PAUSED: '#64748b',
};

const ACWR_COLOR: Record<string, string> = {
  OPTIMAL: '#22c55e', LOW: '#3b82f6', HIGH: '#f59e0b', VERY_HIGH: '#ef4444',
};

const HRV_COLOR: Record<string, string> = {
  BALANCED: '#22c55e', UNBALANCED: '#f59e0b', LOW: '#ef4444', POOR: '#ef4444',
};

/** Status word + load focus + stat tiles always; the load-tunnel bar and
 *  fitness-age tile appear as soon as the measured height fits them (not at
 *  a coarse tier boundary, so small modules stay dense). Two arrangements:
 *  a centered width-capped stack, or side-by-side panes (status left, stats
 *  right) when the box is short and wide. */
export function TrainingStatusView({ timezone, width, height, refreshMs }: ViewProps) {
  const load = useTrainingStatus(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching your training status..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load training status." />;
  }
  const s = load.data;
  if (!s) {
    return (
      <EmptyState
        title="No training status yet"
        body="Your watch hasn't reported a training status. It appears after a couple of weeks of workouts with heart rate."
      />
    );
  }

  const word = s.trainingPaused ? 'PAUSED' : s.status;
  const statusLabel = word ? (sentencePhrase(word) as string) : 'No status';
  const statusColor = word ? STATUS_COLOR[word] ?? 'inherit' : 'inherit';
  const since = formatShortDate(s.sinceDate);
  const focus = loadFocusLabel(s.loadFocus);
  // Extras appear once they actually fit, independent of the tier buckets.
  const showExtras = height >= 340;
  const tiles = statTiles(s, showExtras);

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        fontSize: Math.round(Math.max(34, Math.min(72, height * 0.115))),
        fontWeight: 700, color: statusColor, lineHeight: 1.1,
      }}>
        {statusLabel}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        Training status{since ? ` · since ${since}` : ''}
      </div>
      {focus && (
        <div style={{ fontSize: 15, opacity: 0.8, marginTop: 4 }}>
          Load focus · {focus}
        </div>
      )}
    </div>
  );

  if (isWide(width, height)) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        {header}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {showExtras && <LoadTunnel s={s} width={Math.min(width * 0.4, 380)} />}
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
      // Text card: let the rhythm open up more than the shared stackGap so
      // tall boxes read as intentional air rather than a clump in a void.
      justifyContent: 'center', gap: Math.max(16, Math.min(44, Math.round(height * 0.06))),
    }}>
      {header}
      {showExtras && (
        <LoadTunnel
          s={s} width={Math.min(width, 640)}
          barHeight={Math.round(Math.max(26, Math.min(40, height * 0.055)))}
        />
      )}
      {tiles.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${tiles.length >= 4 ? 2 : tiles.length}, 1fr)`,
          gap: '22px 32px', width: '100%', maxWidth: tiles.length >= 4 ? 520 : 640,
        }}>
          {tiles.map(([label, value, unit, color]) => (
            <StatTile
              key={label} label={label} value={value} unit={unit} color={color} align="center"
              valueSize={Math.round(Math.max(26, Math.min(34, height * 0.055)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function statTiles(
  s: TrainingStatusInfo, includeFitnessAge: boolean,
): [string, string, string | undefined, string | undefined][] {
  const tiles: [string, string, string | undefined, string | undefined][] = [];
  if (s.acwrStatus) {
    tiles.push(['Load', sentencePhrase(s.acwrStatus) as string,
      s.acuteLoad != null ? String(s.acuteLoad) : undefined, ACWR_COLOR[s.acwrStatus]]);
  }
  if (s.hrvStatus) {
    tiles.push(['HRV status', sentencePhrase(s.hrvStatus) as string,
      s.hrvLastNight != null ? `${s.hrvLastNight} ms` : undefined, HRV_COLOR[s.hrvStatus]]);
  }
  if (s.vo2Max != null) tiles.push(['VO2 max', String(s.vo2Max), undefined, undefined]);
  else if (s.vo2MaxCycling != null) tiles.push(['VO2 max (bike)', String(s.vo2MaxCycling), undefined, undefined]);
  if (includeFitnessAge && s.fitnessAge != null) {
    tiles.push(['Fitness age', String(s.fitnessAge), undefined, undefined]);
  }
  return tiles;
}

/** Weekly load marker over the optimal-range band. Scale runs to 25% past
 *  the tunnel (or the load itself when it overshoots further). */
function LoadTunnel({ s, width, barHeight }: {
  s: TrainingStatusInfo; width: number; barHeight?: number;
}) {
  const { weeklyLoad, loadTunnelMin, loadTunnelMax } = s;
  if (weeklyLoad == null || loadTunnelMin == null || loadTunnelMax == null || loadTunnelMax <= 0) {
    return null;
  }
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
        7-day load · {weeklyLoad} (optimal {loadTunnelMin}–{loadTunnelMax})
      </div>
      <MarkerBar
        value={weeklyLoad} bandLow={loadTunnelMin} bandHigh={loadTunnelMax}
        max={Math.max(loadTunnelMax * 1.25, weeklyLoad * 1.1)} width={width} height={barHeight}
      />
    </div>
  );
}
