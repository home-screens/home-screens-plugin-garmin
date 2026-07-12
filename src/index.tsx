import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import type { GarminView, SportFilter, Units, ViewProps, WeeklyStyle, WeeklyWindow } from './types';
import { useGarminData, useConnection, useModuleSize } from './hooks';
import { PLUGIN_ID, stateValues, deriveProvidedKeys } from './shared-state';
import { EmptyState } from './components';
import {
  SummaryView, BodyBatteryView, SleepView, ActivityListView, ActivityHeroView, WeeklyView,
  TrainingReadinessView, TrainingStatusView, HrvView, HeartRateView, WeightView,
} from './views';

const VALID_VIEWS = new Set<string>([
  'summary', 'bodyBattery', 'sleep', 'activities', 'latestActivity', 'weekly',
  'trainingReadiness', 'trainingStatus', 'hrv', 'heartRate', 'weight',
]);
const VALID_FILTERS = new Set<string>([
  'all', 'running', 'cycling', 'swimming', 'walking', 'hiking', 'strength',
]);

export default function Garmin({ config, style, timezone }: PluginComponentProps) {
  const view = (VALID_VIEWS.has(config.view as string) ? config.view : 'summary') as GarminView;
  const units: Units = config.units === 'imperial' ? 'imperial' : 'metric';
  const activityCount = Math.max(1, Math.min(10, (config.activityCount as number) ?? 4));
  const refreshMs = Math.max(300_000, (config.refreshIntervalMs as number) ?? 900_000);
  const sportFilter = (VALID_FILTERS.has(config.sportFilter as string)
    ? config.sportFilter : 'all') as SportFilter;
  const weeklyStyle: WeeklyStyle = config.weeklyStyle === 'individual' ? 'individual' : 'bySport';
  const weeklyWindow: WeeklyWindow = config.weeklyWindow === 'rolling' ? 'rolling' : 'calendar';
  // The host does not pass a timezone prop; the display's timezone lives in
  // host settings. A UTC fallback silently asks Garmin for tomorrow's data
  // every evening (date-keyed endpoints return empty for future dates).
  const tz = timezone ?? window.__HS_SDK__?.getHostSettings().timezone ?? 'UTC';

  // A sport filter searches within the fetched window, so widen it beyond the
  // visible row count when one is active.
  const fetchCount = sportFilter !== 'all' && (view === 'latestActivity' || view === 'activities')
    ? Math.max(activityCount, 20)
    : activityCount;

  const connected = useConnection();
  const load = useGarminData(connected === true, tz, fetchCount, refreshMs);
  const { ref, tier, width, height } = useModuleSize();

  // Publish shared-state keys whenever fresh data lands.
  React.useEffect(() => {
    const publish = window.__HS_SDK__?.publishState;
    if (!publish || load.status !== 'ready') return;
    for (const [k, v] of Object.entries(stateValues(load.data))) publish(PLUGIN_ID, k, v);
  }, [load]);

  const root: React.CSSProperties = {
    width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.textColor,
    backgroundColor: style.backgroundColor, borderRadius: style.borderRadius,
    padding: style.padding, opacity: style.opacity,
    backdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
    WebkitBackdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
  };

  return <div style={root} ref={ref}>{renderBody()}</div>;

  function renderBody() {
    if (connected === null) return <EmptyState title="Loading" body="Checking your Garmin connection..." />;
    if (connected === false) {
      return (
        <EmptyState
          title="Connect your Garmin account"
          body="Open this module's settings in the editor and sign in with your Garmin Connect account to see your health data."
        />
      );
    }
    if (load.status === 'authExpired') {
      return (
        <EmptyState
          title="Reconnect Garmin"
          body="Your Garmin sign-in expired. Open the module settings and sign in again."
        />
      );
    }
    if (load.status === 'loading') return <EmptyState title="Loading" body="Fetching your Garmin data..." />;
    if (load.status === 'error') return <EmptyState title="Can't reach Garmin" body={load.message} />;

    const props: ViewProps = {
      data: load.data, units, timezone: tz, activityCount, tier, width, height,
      sportFilter, weeklyStyle, weeklyWindow, refreshMs,
    };
    switch (view) {
      case 'bodyBattery': return <BodyBatteryView {...props} />;
      case 'sleep': return <SleepView {...props} />;
      case 'activities': return <ActivityListView {...props} />;
      case 'latestActivity': return <ActivityHeroView {...props} />;
      case 'weekly': return <WeeklyView {...props} />;
      case 'trainingReadiness': return <TrainingReadinessView {...props} />;
      case 'trainingStatus': return <TrainingStatusView {...props} />;
      case 'hrv': return <HrvView {...props} />;
      case 'heartRate': return <HeartRateView {...props} />;
      case 'weight': return <WeightView {...props} />;
      default: return <SummaryView {...props} />;
    }
  }
}

// The host editor reads this named export to populate the visibility-condition key picker.
export { deriveProvidedKeys };
export { default as ConfigSection } from './ConfigSection';
