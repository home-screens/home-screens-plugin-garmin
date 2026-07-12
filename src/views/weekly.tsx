import React from 'react';
import type { SportTotal, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { DayBars, SportBadge, SportBadgeFor } from '../charts';
import { formatDistance, formatDuration } from '../format';
import { matchesFilter, sportByKey, sportFor } from '../sports';
import { useFirstDayOfWeek, useWeeklyActivities } from '../hooks';
import { consistencyDays, relativeDay, todayIso, weekStartIso, weeklyRollup } from '../aggregate';

/** Rolling last-7-days rollup from its own range fetch (the daily bundle only
 *  carries activityCount ≤ 10 rows). DayBars + week-total row always; the
 *  breakdown (per-sport totals or one row per workout, per weeklyStyle) shows
 *  as many rows as the measured height fits — most people have one or two
 *  sports, so the list isn't sacrificed to space reserved for hypothetical
 *  ones. The bars absorb the leftover height. */
export function WeeklyView({ units, timezone, sportFilter, weeklyStyle, weeklyWindow, refreshMs, width, height }: ViewProps) {
  const load = useWeeklyActivities(timezone, refreshMs);
  const firstDay = useFirstDayOfWeek();

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

  // Calendar week anchored to the user's Connect first-day-of-week setting
  // (so bars and totals match the Garmin app), or a rolling last-7-days
  // window when configured.
  const now = new Date();
  const today = todayIso(now, timezone);
  // A pinned sport filters the whole window before any rollup, so bars, totals,
  // the breakdown, and the consistency strip all reflect that one sport.
  const sportActs = sportFilter === 'all'
    ? load.activities
    : load.activities.filter((a) => matchesFilter(a.typeKey, sportFilter));
  const weekly = weeklyRollup(
    sportActs, now, timezone,
    weeklyWindow === 'rolling' ? undefined : weekStartIso(today, firstDay),
  );
  // The individual-workout list shows only the displayed week; the fetch now
  // spans 28 days for the consistency strip, so window it here (the rollup
  // already self-windows its totals and bars).
  const windowStart = weekly.days[0].key, windowEnd = weekly.days[6].key;
  const weekActs = sportActs.filter((a) => {
    const d = (a.startLocal ?? '').slice(0, 10);
    return d >= windowStart && d <= windowEnd;
  });
  const top = weekly.sports.slice(0, 5);
  const rest = weekly.sports.slice(5);
  const other: SportTotal | null = rest.length
    ? rest.reduce((acc, s) => ({
        sport: 'other', sessions: acc.sessions + s.sessions,
        distanceMeters: acc.distanceMeters + s.distanceMeters,
        durationSeconds: acc.durationSeconds + s.durationSeconds,
      }), { sport: 'other' as const, sessions: 0, distanceMeters: 0, durationSeconds: 0 })
    : null;

  // Height budget: bars label ~20, totals ~54, list rows ~53 each, gaps 18.
  // Rows get first claim (with minimum bars); the bars absorb the leftover.
  const ROW_H = 53, MIN_BARS = 90;
  const fixed = 20 + 54 + 18 * 2 + 12;
  const maxRows = Math.max(0, Math.floor((height - MIN_BARS - fixed) / ROW_H));
  const allRows = weeklyStyle === 'individual'
    ? weekActs.length
    : top.length + (other ? 1 : 0);
  const shownRows = Math.min(allRows, maxRows);
  const hiddenRows = allRows - shownRows;
  // The 4-week strip (label + dots + its own gap) claims height only from the
  // bars' leftover, after the breakdown rows and the minimum bars are covered,
  // so it never costs a breakdown row.
  const DOTS_H = 40, DOTS_GAP = 18;
  const rowsBottom = shownRows * ROW_H + (hiddenRows > 0 ? 22 : 0);
  const showDots = height - fixed - MIN_BARS - rowsBottom >= DOTS_H + DOTS_GAP;
  const barsH = Math.round(Math.max(MIN_BARS, Math.min(
    height * 0.56,
    height - fixed - rowsBottom - (showDots ? DOTS_H + DOTS_GAP : 0),
  )));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 18 }}>
      <DayBars days={weekly.days} height={barsH} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <StatTile label="Time" value={formatDuration(weekly.totalSeconds)} />
        <StatTile label="Distance" value={formatDistance(weekly.totalDistanceMeters, units)} />
        <StatTile label="Sessions" value={String(weekly.totalSessions)} />
      </div>
      {shownRows > 0 && (top.length > 0 ? (
        weeklyStyle === 'individual' ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {weekActs.slice(0, shownRows).map((a) => (
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
            {hiddenRows > 0 && (
              <div style={{ opacity: 0.5, fontSize: 12, paddingTop: 6 }}>+{hiddenRows} more</div>
            )}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...top, ...(other ? [other] : [])].slice(0, shownRows).map((s) => {
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
          {hiddenRows > 0 && (
            <div style={{ opacity: 0.5, fontSize: 12, paddingTop: 6 }}>+{hiddenRows} more</div>
          )}
        </div>
        )
      ) : (
        <div style={{ opacity: 0.5, textAlign: 'center', fontSize: 14 }}>No workouts this week yet</div>
      ))}
      {showDots && (
        <ConsistencyDots
          days={consistencyDays(sportActs, today, 28)} width={width}
          color={sportFilter === 'all' ? PALETTE.steps : sportByKey(sportFilter).color}
        />
      )}
    </div>
  );
}

/** The Connect card's "Last 4w" strip: one dot per day for the last 28 days,
 *  filled when a (matching) activity happened that day, faint otherwise. */
/** Dots spread across the full module width and scale with it, so a wide
 *  module reads as a strip rather than a huddle in the corner. */
function ConsistencyDots({ days, color, width }: { days: boolean[]; color: string; width: number }) {
  const size = Math.max(6, Math.min(14, Math.floor((width / days.length) * 0.45)));
  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Last 4 weeks</div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {days.map((active, i) => (
          <span key={i} style={{
            width: size, height: size, borderRadius: size / 2, flexShrink: 0,
            background: active ? color : PALETTE.rail,
          }} />
        ))}
      </div>
    </div>
  );
}
