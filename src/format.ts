import type { Units } from './types';

/** Seconds → "7h 32m" (or "0m"). */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0m';
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
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

/** Total seconds → "m:ss" with rounding applied before the split, so 299.6s
 *  becomes "5:00", never "4:60". */
function mmss(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** m/s → "5:13 /km" or "8:23 /mi". Null/zero speed → "--". */
export function formatPace(metersPerSecond: number | null, units: Units): string {
  if (!metersPerSecond || metersPerSecond <= 0) return '--';
  const unitMeters = units === 'imperial' ? 1609.344 : 1000;
  return `${mmss(unitMeters / metersPerSecond)} ${units === 'imperial' ? '/mi' : '/km'}`;
}

/** m/s → "24.1 km/h" or "15.0 mph". Null/zero → "--". */
export function formatSpeed(metersPerSecond: number | null, units: Units): string {
  if (!metersPerSecond || metersPerSecond <= 0) return '--';
  const v = units === 'imperial' ? metersPerSecond * 2.236936 : metersPerSecond * 3.6;
  return `${v.toFixed(1)} ${units === 'imperial' ? 'mph' : 'km/h'}`;
}

/** Swim pace: m/s → "1:45 /100m" (metric) or "1:36 /100yd" (imperial). */
export function formatSwimPace(metersPerSecond: number | null, units: Units): string {
  if (!metersPerSecond || metersPerSecond <= 0) return '--';
  const unitMeters = units === 'imperial' ? 91.44 : 100;
  return `${mmss(unitMeters / metersPerSecond)} ${units === 'imperial' ? '/100yd' : '/100m'}`;
}

/** Meters climbed → "320 m" or "1,051 ft". */
export function formatElevation(meters: number | null, units: Units): string {
  if (meters == null) return '--';
  if (units === 'imperial') return `${Math.round(meters * 3.28084).toLocaleString('en-US')} ft`;
  return `${Math.round(meters).toLocaleString('en-US')} m`;
}

/** Seconds → "4:52" for split rows (formatDuration's "25m" is too coarse there). */
export function formatMinSec(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--';
  return mmss(seconds);
}
