import React from 'react';
import type { PluginConfigSectionProps } from './hs-plugin';

const VIEWS = [
  ['summary', 'Daily summary', 'Steps ring with Body Battery, resting heart rate, stress, and sleep score.'],
  ['bodyBattery', 'Body Battery', "Current Body Battery with today's charge and drain trend."],
  ['sleep', 'Sleep', "Last night's sleep stages, duration, and bed/wake times."],
  ['activities', 'Activities', 'Your most recent workouts with distance, time, and heart rate.'],
] as const;

export default function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
  const Heading =
    window.__HS_SDK__?.SectionHeading ??
    (({ children }: { children: React.ReactNode }) => <h4>{children}</h4>);
  const view = (config.view as string) ?? 'summary';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Heading>About this module</Heading>
      <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
        Sign in to Garmin in the Connection section above. Then pick what to show:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VIEWS.map(([value, label, help]) => (
          <label key={value} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="radio"
              name="garmin-view"
              checked={view === value}
              onChange={() => onChange({ view: value })}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <br />
              <span style={{ fontSize: 12, opacity: 0.6 }}>{help}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
