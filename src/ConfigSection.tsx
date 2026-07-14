import React from 'react';
import type { PluginConfigSectionProps } from './hs-plugin';

const VIEWS = [
  ['summary', 'Daily summary', 'Steps ring with Body Battery, resting heart rate, stress, and sleep score.'],
  ['bodyBattery', 'Body Battery', "Current Body Battery with today's charge, drain, and stress trend."],
  ['stress', 'Stress', "Today's average stress, time at each level, and the day's curve."],
  ['sleep', 'Sleep', "Last night's sleep stages, duration, and bed/wake times."],
  ['activities', 'Activities', 'Your most recent workouts with distance, time, and heart rate.'],
  ['latestActivity', 'Latest activity', 'A closer look at your newest workout: stats, charts, and splits.'],
  ['weekly', 'Weekly training', "This week's workouts, day by day and sport by sport."],
  ['trainingReadiness', 'Training readiness', "How ready your body is to train today, and what's helping or holding you back."],
  ['trainingStatus', 'Training status', 'Whether your training is paying off, with training load and VO2 max.'],
  ['hrv', 'HRV status', 'Overnight heart rate variability against your balanced range, with a 4-week trend.'],
  ['heartRate', 'Heart rate', "Resting heart rate, 7-day average, and today's ups and downs."],
  ['racePredictions', 'Race predictions', "Your watch's predicted 5K, 10K, half-marathon, and marathon times."],
  ['records', 'Personal records', 'Your best efforts: fastest runs, longest run, ride, and swim, and step records.'],
  ['weight', 'Weight', 'Your latest weigh-in, BMI, and a 4-week trend. Only shows if you use a scale or log it.'],
] as const;

const SPORTS = [
  ['all', 'All sports'],
  ['running', 'Running'],
  ['cycling', 'Cycling'],
  ['swimming', 'Swimming'],
  ['walking', 'Walking'],
  ['hiking', 'Hiking'],
  ['strength', 'Strength'],
] as const;

const REFRESH_OPTIONS = [
  ['300000', '5 min'],
  ['900000', '15 min'],
  ['1800000', '30 min'],
  ['3600000', '1 hour'],
] as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  borderRadius: 6,
  background: 'rgba(148,163,184,0.08)',
  color: 'inherit',
  border: '1px solid rgba(148,163,184,0.25)',
  colorScheme: 'dark',
};

/* The host renders a plugin's custom ConfigSection INSTEAD of the manifest
 * configSchema (strict priority in PropertyPanel), so every setting must be
 * rendered here — schema fields never appear alongside this section. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      {children}
    </div>
  );
}

/* Native <select> popups are OS controls that ignore page styling on macOS
 * (dark-on-dark options in the editor), so choices render as buttons instead. */
function Choices({
  value, options, onPick,
}: {
  value: string;
  options: readonly (readonly [string, string])[];
  onPick: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([v, label]) => {
        const selected = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              borderRadius: 6,
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: selected ? 600 : 400,
              background: selected ? 'rgba(59,130,246,0.28)' : 'rgba(148,163,184,0.08)',
              border: `1px solid ${selected ? '#3b82f6' : 'rgba(148,163,184,0.25)'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
  const Heading =
    window.__HS_SDK__?.SectionHeading ??
    (({ children }: { children: React.ReactNode }) => <h4>{children}</h4>);
  const view = (config.view as string) ?? 'summary';
  const units = config.units === 'imperial' ? 'imperial' : 'metric';
  const sportFilter = (config.sportFilter as string) ?? 'all';
  const weeklyStyle = config.weeklyStyle === 'individual' ? 'individual' : 'bySport';
  const weeklyWindow = config.weeklyWindow === 'rolling' ? 'rolling' : 'calendar';
  const activityCount = (config.activityCount as number) ?? 4;
  const refreshMs = String((config.refreshIntervalMs as number) ?? 900_000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

      {view === 'activities' && (
        <Field label="Workouts to show">
          <input
            type="number"
            min={1}
            max={10}
            value={activityCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange({ activityCount: Math.max(1, Math.min(10, Math.round(n))) });
            }}
            style={inputStyle}
          />
        </Field>
      )}

      {(view === 'activities' || view === 'latestActivity' || view === 'weekly') && (
        <Field label="Sport">
          <Choices value={sportFilter} options={SPORTS} onPick={(v) => onChange({ sportFilter: v })} />
        </Field>
      )}

      {view === 'weekly' && (
        <>
          <Field label="Week">
            <Choices
              value={weeklyWindow}
              options={[['calendar', 'This week (like Garmin)'], ['rolling', 'Last 7 days']] as const}
              onPick={(v) => onChange({ weeklyWindow: v })}
            />
          </Field>
          <Field label="Weekly list">
            <Choices
              value={weeklyStyle}
              options={[['bySport', 'Group by sport'], ['individual', 'List each workout']] as const}
              onPick={(v) => onChange({ weeklyStyle: v })}
            />
          </Field>
        </>
      )}

      <Field label="Units">
        <Choices
          value={units}
          options={[['metric', 'Metric (km)'], ['imperial', 'Imperial (mi)']] as const}
          onPick={(v) => onChange({ units: v })}
        />
      </Field>

      <Field label="Refresh">
        <Choices value={refreshMs} options={REFRESH_OPTIONS} onPick={(v) => onChange({ refreshIntervalMs: Number(v) })} />
      </Field>
    </div>
  );
}
