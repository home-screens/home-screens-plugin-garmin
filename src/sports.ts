import type { SportKey, SportFilter, MetricSource, Units } from './types';
import { PALETTE } from './theme';
import {
  formatPace, formatSpeed, formatSwimPace, formatElevation,
  formatDuration, formatDistance, formatCount,
} from './format';

export type MetricKey =
  | 'pace' | 'speed' | 'pacePer100m' | 'duration' | 'distance'
  | 'avgHr' | 'elevationGain' | 'cadence' | 'calories' | 'avgPower';

export interface Sport {
  key: SportKey;
  label: string;        // "Run", "Ride" — banner / badge fallback text
  plural: string;       // "runs", "rides" — empty-state wording
  color: string;        // 6-digit hex from PALETTE.sports
  metrics: MetricKey[]; // ordered stat set: first 4 at compact, all at medium+
}

/** Garmin activityType typeKey → sport bucket. Unknown keys → 'other'. */
const TYPE_TO_SPORT: Record<string, SportKey> = {
  running: 'running', treadmill_running: 'running', trail_running: 'running',
  track_running: 'running', indoor_running: 'running', virtual_run: 'running',
  cycling: 'cycling', road_biking: 'cycling', mountain_biking: 'cycling',
  indoor_cycling: 'cycling', gravel_cycling: 'cycling', virtual_ride: 'cycling',
  lap_swimming: 'swimming', open_water_swimming: 'swimming', swimming: 'swimming',
  walking: 'walking', casual_walking: 'walking', speed_walking: 'walking',
  hiking: 'hiking', rucking: 'hiking',
  strength_training: 'strength',
};

const SPORTS: Record<SportKey, Sport> = {
  running:  { key: 'running',  label: 'Run',      plural: 'runs',              color: PALETTE.sports.running,  metrics: ['pace', 'duration', 'avgHr', 'elevationGain', 'cadence', 'calories'] },
  walking:  { key: 'walking',  label: 'Walk',     plural: 'walks',             color: PALETTE.sports.walking,  metrics: ['pace', 'duration', 'avgHr', 'elevationGain', 'cadence', 'calories'] },
  hiking:   { key: 'hiking',   label: 'Hike',     plural: 'hikes',             color: PALETTE.sports.hiking,   metrics: ['pace', 'duration', 'avgHr', 'elevationGain', 'cadence', 'calories'] },
  cycling:  { key: 'cycling',  label: 'Ride',     plural: 'rides',             color: PALETTE.sports.cycling,  metrics: ['speed', 'duration', 'avgPower', 'avgHr', 'elevationGain', 'calories'] },
  swimming: { key: 'swimming', label: 'Swim',     plural: 'swims',             color: PALETTE.sports.swimming, metrics: ['pacePer100m', 'duration', 'distance', 'avgHr', 'calories'] },
  strength: { key: 'strength', label: 'Strength', plural: 'strength workouts', color: PALETTE.sports.strength, metrics: ['duration', 'calories', 'avgHr'] },
  other:    { key: 'other',    label: 'Activity', plural: 'activities',        color: PALETTE.sports.other,    metrics: ['duration', 'calories', 'avgHr'] },
};

export function sportFor(typeKey: string): Sport {
  return SPORTS[TYPE_TO_SPORT[typeKey] ?? 'other'];
}

export function sportByKey(key: SportKey): Sport {
  return SPORTS[key];
}

export function matchesFilter(typeKey: string, filter: SportFilter): boolean {
  return filter === 'all' || sportFor(typeKey).key === filter;
}

/** The metrics actually renderable for this source. Spec rule: avgPower drops
 *  out when the ride has no power meter; every other missing metric renders '--'. */
export function metricsFor(sport: Sport, source: MetricSource): MetricKey[] {
  return sport.metrics.filter((m) => m !== 'avgPower' || source.avgPower != null);
}

export interface FormattedMetric { key: MetricKey; label: string; value: string }

/** averageSpeed when Garmin reports it, else derived distance/duration. */
function effectiveSpeed(source: MetricSource): number | null {
  if (source.averageSpeed != null && source.averageSpeed > 0) return source.averageSpeed;
  if (source.distanceMeters > 0 && source.durationSeconds > 0) {
    return source.distanceMeters / source.durationSeconds;
  }
  return null;
}

export function formatMetric(key: MetricKey, source: MetricSource, units: Units): FormattedMetric {
  const speed = effectiveSpeed(source);
  switch (key) {
    case 'pace': return { key, label: 'Pace', value: formatPace(speed, units) };
    case 'speed': return { key, label: 'Speed', value: formatSpeed(speed, units) };
    case 'pacePer100m': return { key, label: 'Pace', value: formatSwimPace(speed, units) };
    case 'duration': return { key, label: 'Time', value: formatDuration(source.durationSeconds) };
    case 'distance': return { key, label: 'Distance', value: formatDistance(source.distanceMeters, units) };
    case 'avgHr': return { key, label: 'Avg HR', value: source.averageHr != null ? `${Math.round(source.averageHr)} bpm` : '--' };
    case 'elevationGain': return { key, label: 'Elev gain', value: formatElevation(source.elevationGain, units) };
    case 'cadence': return { key, label: 'Cadence', value: source.cadence != null ? `${Math.round(source.cadence)} spm` : '--' };
    case 'calories': return { key, label: 'Calories', value: source.calories != null ? formatCount(Math.round(source.calories)) : '--' };
    case 'avgPower': return { key, label: 'Power', value: source.avgPower != null ? `${Math.round(source.avgPower)} W` : '--' };
  }
}
