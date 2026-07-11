import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import type { GarminView, Units } from './types';
import { useGarminData, useConnection } from './hooks';
import { PLUGIN_ID, stateValues, deriveProvidedKeys } from './shared-state';
import { EmptyState } from './components';
import { SummaryView, BodyBatteryView, SleepView, ActivitiesView } from './views';

const VALID_VIEWS = new Set<string>(['summary', 'bodyBattery', 'sleep', 'activities']);

export default function Garmin({ config, style, timezone }: PluginComponentProps) {
  const view = (VALID_VIEWS.has(config.view as string) ? config.view : 'summary') as GarminView;
  const units: Units = config.units === 'imperial' ? 'imperial' : 'metric';
  const activityCount = Math.max(1, Math.min(10, (config.activityCount as number) ?? 4));
  const refreshMs = Math.max(300_000, (config.refreshIntervalMs as number) ?? 900_000);
  const tz = timezone ?? 'UTC';

  const connected = useConnection();
  const load = useGarminData(connected === true, tz, activityCount, refreshMs);

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

  return <div style={root}>{renderBody()}</div>;

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

    const props = { data: load.data, units, timezone: tz, activityCount };
    switch (view) {
      case 'bodyBattery': return <BodyBatteryView {...props} />;
      case 'sleep': return <SleepView {...props} />;
      case 'activities': return <ActivitiesView {...props} />;
      default: return <SummaryView {...props} />;
    }
  }
}

// The host editor reads this named export to populate the visibility-condition key picker.
export { deriveProvidedKeys };
export { default as ConfigSection } from './ConfigSection';
