import React from 'react';
import type { MetricSource, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { SportBadgeFor, SplitsTable, TraceChart, ZoneBars } from '../charts';
import { formatMetric, matchesFilter, metricsFor, sportByKey, sportFor } from '../sports';
import { relativeDay } from '../aggregate';
import { useActivityDetail } from '../hooks';

/** Newest activity matching sportFilter. Detail endpoints degrade
 *  independently: no traces → no chart, no zones → no bars, no detail at all
 *  → stats from the list row. compact: banner + 2×2 grid. medium: + trace
 *  chart + zone bars. large: + splits table + full metric grid. */
export function ActivityHeroView({ data, units, timezone, tier, width, sportFilter }: ViewProps) {
  const activity = data.activities.find((a) => matchesFilter(a.typeKey, sportFilter)) ?? null;
  const detail = useActivityDetail(activity?.id ?? null);

  if (!activity) {
    const what = sportFilter === 'all' ? 'activities' : sportByKey(sportFilter).plural;
    return (
      <EmptyState
        title={`No recent ${what} yet`}
        body="Your latest workout will show up here after your watch syncs to Garmin Connect."
      />
    );
  }
  if (detail.status === 'authExpired') {
    return (
      <EmptyState
        title="Reconnect Garmin"
        body="Your Garmin sign-in expired. Open the module settings and sign in again."
      />
    );
  }

  const sport = sportFor(activity.typeKey);
  const bundle = detail.status === 'ready' ? detail.bundle : null;
  const source: MetricSource = bundle?.detail ?? activity;
  const keys = metricsFor(sport, source);
  const shown = tier === 'compact' ? keys.slice(0, 4) : keys;
  const cols = tier !== 'compact' && width >= 460 ? 3 : 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SportBadgeFor typeKey={activity.typeKey} size={tier === 'compact' ? 44 : 52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: tier === 'compact' ? 18 : 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activity.name}
          </div>
          <div style={{ fontSize: 13, opacity: 0.65 }}>
            {sport.label} · {relativeDay(activity.startLocal, new Date(), timezone)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
        {shown.map((k) => {
          const m = formatMetric(k, source, units);
          return <StatTile key={m.key} label={m.label} value={m.value} color={m.key === 'avgHr' ? PALETTE.heart : undefined} />;
        })}
      </div>

      {tier !== 'compact' && bundle?.traces && (
        <TraceChart traces={bundle.traces} width={width} height={tier === 'large' ? 160 : 120} />
      )}
      {tier !== 'compact' && bundle?.zones && <ZoneBars zones={bundle.zones} />}
      {tier === 'large' && bundle?.splits && (
        <div style={{ marginTop: 'auto' }}>
          <SplitsTable splits={bundle.splits} units={units} maxRows={8} />
        </div>
      )}
    </div>
  );
}
