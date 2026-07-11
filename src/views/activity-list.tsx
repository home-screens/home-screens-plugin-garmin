import React from 'react';
import type { GarminActivity, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState } from '../components';
import { SportBadgeFor } from '../charts';
import { activityLabel, formatDistance, formatElevation } from '../format';
import { formatMetric, matchesFilter, metricsFor, sportByKey, sportFor } from '../sports';
import { relativeDay } from '../aggregate';

/** Rows: SportBadge, name + label + relative day, right-aligned metric trio
 *  (distance → sport primary metric → HR). Elevation joins at medium+.
 *  Large groups rows under relative-day headers. */
export function ActivityListView({ data, units, timezone, activityCount, tier, sportFilter }: ViewProps) {
  const now = new Date();
  const rows = data.activities
    .filter((a) => matchesFilter(a.typeKey, sportFilter))
    .slice(0, activityCount);

  if (rows.length === 0) {
    const what = sportFilter === 'all' ? 'activities' : sportByKey(sportFilter).plural;
    return (
      <EmptyState
        title={`No recent ${what} yet`}
        body="New workouts from Garmin Connect will show up here after your watch syncs."
      />
    );
  }

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
              tier !== 'compact' && a.elevationGain != null ? `↑ ${formatElevation(a.elevationGain, units)}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    );
  };

  if (tier !== 'large') {
    return <div style={{ display: 'flex', flexDirection: 'column' }}>{rows.map(row)}</div>;
  }

  // Large: group rows under relative-day headers, preserving order.
  const groups: { day: string; items: GarminActivity[] }[] = [];
  for (const a of rows) {
    const day = relativeDay(a.startLocal, now, timezone) || 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {groups.map((g) => (
        <div key={g.day}>
          <div style={{ fontSize: 12, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 0 2px' }}>
            {g.day}
          </div>
          {g.items.map(row)}
        </div>
      ))}
    </div>
  );
}
