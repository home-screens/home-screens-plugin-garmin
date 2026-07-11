import type { Units } from './types';

/** Seconds → "7h 32m" (or "0m"). */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Meters → "5.20 km" or "3.23 mi"; one decimal past 10. */
export function formatDistance(meters: number, units: Units): string {
  if (units === 'imperial') {
    const mi = meters / 1609.344;
    return `${mi.toFixed(mi < 10 ? 2 : 1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

/** 8421 → "8,421". */
export function formatCount(n: number | null): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US');
}

/** Epoch ms → "10:45 PM" in the given timezone. */
export function formatClock(epochMs: number | null, timezone: string): string {
  if (epochMs == null) return '--';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: timezone,
  }).format(new Date(epochMs));
}

/** A Garmin activityType typeKey → a short display label. */
export function activityLabel(typeKey: string): string {
  const map: Record<string, string> = {
    running: 'Run', treadmill_running: 'Treadmill', trail_running: 'Trail run',
    cycling: 'Ride', road_biking: 'Ride', mountain_biking: 'MTB', indoor_cycling: 'Indoor ride',
    lap_swimming: 'Swim', open_water_swimming: 'Open water', walking: 'Walk', hiking: 'Hike',
    strength_training: 'Strength', yoga: 'Yoga', cardio: 'Cardio',
  };
  return map[typeKey] ?? typeKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
