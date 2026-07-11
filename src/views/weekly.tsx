import React from 'react';
import type { SportTotal, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { DayBars, SportBadge, SportBadgeFor } from '../charts';
import { formatDistance, formatDuration } from '../format';
import { sportByKey, sportFor } from '../sports';
import { useWeeklyActivities } from '../hooks';
import { relativeDay, weeklyRollup } from '../aggregate';

/** Rolling last-7-days rollup from its own range fetch (the daily bundle only
 *  carries activityCount ≤ 10 rows). compact: DayBars + week-total row.
 *  medium/large: + a breakdown per weeklyStyle — per-sport totals (top 5 by
 *  time + "Other") or one row per workout, newest first. */
export function WeeklyView({ units, timezone, tier, weeklyStyle, refreshMs }: ViewProps) {
  const load = useWeeklyActivities(timezone, refreshMs);

  if (load.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }
  if (load.status === 'loading') {
    return <EmptyState title="Loading" body="Fetching this week's activities..." />;
  }
  if (load.status === 'error') {
    return <EmptyState title="Can't reach Garmin" body="Could not load this week's activities." />;
  }

  const weekly = weeklyRollup(load.activities, new Date(), timezone);
  const top = weekly.sports.slice(0, 5);
  const rest = weekly.sports.slice(5);
  const other: SportTotal | null = rest.length
    ? rest.reduce((acc, s) => ({
        sport: 'other', sessions: acc.sessions + s.sessions,
        distanceMeters: acc.distanceMeters + s.distanceMeters,
        durationSeconds: acc.durationSeconds + s.durationSeconds,
      }), { sport: 'other' as const, sessions: 0, distanceMeters: 0, durationSeconds: 0 })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18 }}>
      <DayBars days={weekly.days} height={tier === 'compact' ? 110 : 150} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <StatTile label="Time" value={formatDuration(weekly.totalSeconds)} />
        <StatTile label="Distance" value={formatDistance(weekly.totalDistanceMeters, units)} />
        <StatTile label="Sessions" value={String(weekly.totalSessions)} />
      </div>
      {tier !== 'compact' && (top.length > 0 ? (
        weeklyStyle === 'individual' ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {load.activities.map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: `1px solid ${PALETTE.rail}`,
              }}>
                <SportBadgeFor typeKey={a.typeKey} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {sportFor(a.typeKey).label} · {relativeDay(a.startLocal, new Date(), timezone)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, fontVariantNumeric: 'tabular-nums', fontSize: 14, opacity: 0.8 }}>
                  <span>{formatDistance(a.distanceMeters, units)}</span>
                  <span>{formatDuration(a.durationSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...top, ...(other ? [other] : [])].map((s) => {
            const sport = sportByKey(s.sport);
            return (
              <div key={s.sport} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: `1px solid ${PALETTE.rail}`,
              }}>
                <SportBadge sport={sport} size={36} />
                <div style={{ flex: 1, fontWeight: 600 }}>{s.sport === 'other' && rest.length ? 'Other' : sport.label}</div>
                <div style={{ display: 'flex', gap: 18, fontVariantNumeric: 'tabular-nums', fontSize: 14, opacity: 0.8 }}>
                  <span>{s.sessions}×</span>
                  <span>{formatDistance(s.distanceMeters, units)}</span>
                  <span>{formatDuration(s.durationSeconds)}</span>
                </div>
              </div>
            );
          })}
        </div>
        )
      ) : (
        <div style={{ opacity: 0.5, textAlign: 'center', fontSize: 14 }}>No workouts this week yet</div>
      ))}
    </div>
  );
}
