import React from 'react';
import type { GarminActivity, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState } from '../components';
import { SportBadgeFor } from '../charts';
import { activityLabel, formatDistance, formatElevation } from '../format';
import { formatMetric, matchesFilter, metricsFor, sportByKey, sportFor } from '../sports';
import { relativeDay } from '../aggregate';

/** Rows: SportBadge, name + label + relative day, right-aligned metric trio
 *  (distance → sport primary metric → HR → elevation). The list shows as many
 *  rows as the measured height fits (~62px each) with a "+N more" line when
 *  truncated, so it fills short and tall boxes alike instead of a fixed count. */
export function ActivityListView({ data, units, timezone, activityCount, height, sportFilter }: ViewProps) {
  const now = new Date();
  const all = data.activities
    .filter((a) => matchesFilter(a.typeKey, sportFilter))
    .slice(0, activityCount);

  if (all.length === 0) {
    const what = sportFilter === 'all' ? 'activities' : sportByKey(sportFilter).plural;
    return (
      <EmptyState
        title={`No recent ${what} yet`}
        body="New workouts from Garmin Connect will show up here after your watch syncs."
      />
    );
  }

  // As many rows as fit; when truncated, one row's worth of space goes to the
  // "+N more" line so it never overflows.
  const ROW_H = 74, MORE_H = 26;
  const fitAll = Math.floor(height / ROW_H) >= all.length;
  const shownRows = fitAll
    ? all.length
    : Math.max(1, Math.floor((height - MORE_H) / ROW_H));
  const hidden = all.length - shownRows;

  const row = (a: GarminActivity) => {
    const sport = sportFor(a.typeKey);
    // First pace/speed-flavored metric in the sport's set — its headline number.
    const primaryKey = metricsFor(sport, a).find((k) => k === 'pace' || k === 'speed' || k === 'pacePer100m');
    const primary = primaryKey ? formatMetric(primaryKey, a, units).value : null;
    const day = relativeDay(a.startLocal, now, timezone);
    return (
      <div key={a.id} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
        borderBottom: `1px solid ${PALETTE.rail}`,
      }}>
        <SportBadgeFor typeKey={a.typeKey} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {activityLabel(a.typeKey)}{day ? ` · ${day}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontWeight: 600 }}>{formatDistance(a.distanceMeters, units)}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {[
              primary,
              a.averageHr != null ? `${Math.round(a.averageHr)} bpm` : null,
              a.elevationGain != null ? `↑ ${formatElevation(a.elevationGain, units)}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {all.slice(0, shownRows).map(row)}
      {hidden > 0 && (
        <div style={{ opacity: 0.5, fontSize: 12, paddingTop: 8 }}>+{hidden} more</div>
      )}
    </div>
  );
}
