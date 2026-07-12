import React from 'react';
import type { MetricSource, ViewProps } from '../types';
import { PALETTE } from '../theme';
import { EmptyState, StatTile } from '../components';
import { SportBadgeFor, SplitsTable, TraceChart, ZoneBars } from '../charts';
import { formatMetric, matchesFilter, metricsFor, sportByKey, sportFor } from '../sports';
import { relativeDay } from '../aggregate';
import { useActivityDetail } from '../hooks';

/** Newest activity matching sportFilter: banner + metric grid always. The
 *  detail sections (trace chart, HR-zone bars, splits table) each appear when
 *  the measured height fits them, and the chart absorbs the leftover height so
 *  the box fills. Detail endpoints degrade independently: no traces → no chart,
 *  no zones → no bars, no detail at all → stats from the list row. */
export function ActivityHeroView({ data, units, timezone, width, height, sportFilter }: ViewProps) {
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
  const compact = height < 340;
  const cols = width >= 460 ? 3 : 2;
  const keys = metricsFor(sport, source);
  const shown = compact ? keys.slice(0, 4) : keys;
  const gridRows = Math.ceil(shown.length / cols);

  const hasTraces = !!bundle?.traces && (bundle.traces.hr.length >= 2 || bundle.traces.elevation.length >= 2);
  const hasZones = !!bundle?.zones && bundle.zones.length > 0;
  const splits = bundle?.splits ?? [];

  // Height budget: banner + metric grid are fixed; zones (~96) and splits
  // (header + ~23/row) are added when they fit, reserving the chart's minimum;
  // the chart then absorbs whatever height remains. Estimates run slightly
  // high so the box never overflows.
  const G = 16, SLACK = 12, MIN_CHART = 100, CHART_CAP = 240;
  const ZONES_H = 96, SPLIT_HEADER = 22, SPLIT_ROW = 23, MORE_H = 22;
  const bannerH = compact ? 48 : 56;
  const gridH = gridRows * 50 + (gridRows - 1) * 14;
  const chartReserve = hasTraces ? MIN_CHART : 0;
  const baseUsed = bannerH + gridH;

  const showZones = hasZones
    && baseUsed + chartReserve + ZONES_H + 3 * G + SLACK <= height;

  let shownSplits = 0;
  if (splits.length > 0) {
    const fixed = baseUsed + chartReserve + (showZones ? ZONES_H : 0)
      + SPLIT_HEADER + MORE_H + 4 * G + SLACK;
    shownSplits = Math.min(splits.length, 12, Math.max(0, Math.floor((height - fixed) / SPLIT_ROW)));
  }
  const hiddenSplits = splits.length - shownSplits;
  const splitsH = shownSplits > 0
    ? SPLIT_HEADER + shownSplits * SPLIT_ROW + (hiddenSplits > 0 ? MORE_H : 0)
    : 0;

  // The chart takes the exact leftover (so the stack fills without overflow).
  const sections = 2 + (hasTraces ? 1 : 0) + (showZones ? 1 : 0) + (shownSplits > 0 ? 1 : 0);
  const leftover = height - bannerH - gridH - (showZones ? ZONES_H : 0) - splitsH
    - (sections - 1) * G - SLACK;
  const showChart = hasTraces && leftover >= MIN_CHART;
  const chartH = Math.min(CHART_CAP, leftover);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: G }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SportBadgeFor typeKey={activity.typeKey} size={compact ? 44 : 52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {showChart && bundle?.traces && (
        <TraceChart traces={bundle.traces} width={width} height={Math.round(chartH)} />
      )}
      {showZones && bundle?.zones && <ZoneBars zones={bundle.zones} />}
      {shownSplits > 0 && (
        <SplitsTable splits={splits} units={units} maxRows={shownSplits} />
      )}
    </div>
  );
}
