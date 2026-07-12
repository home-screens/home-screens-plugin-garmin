import type { GarminActivity, SportKey, SportTotal, WeeklyData, WeeklyDay } from './types';
import { sportFor } from './sports';

/** "2026-07-11 06:30:00" → "2026-07-11". Garmin's startTimeLocal is already
 *  in the watch's local time, so the date part needs no timezone math. */
function dayOf(startLocal: string | null): string | null {
  if (!startLocal || startLocal.length < 10) return null;
  return startLocal.slice(0, 10);
}

/** Today's ISO date in the display's timezone (en-CA formats as YYYY-MM-DD). */
export function todayIso(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}

/** ISO date `days` before an ISO date. Anchored at noon UTC so day arithmetic
 *  never lands on a DST boundary. */
export function isoDaysBefore(isoDate: string, days: number): string {
  const anchor = new Date(`${isoDate}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return anchor.toISOString().slice(0, 10);
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weekday index (0=Sun) of an ISO date, DST-safe via the noon-UTC anchor. */
function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** Start of the current calendar week for a user whose week begins on
 *  `firstDay` (JS weekday index, 0 = Sunday). */
export function weekStartIso(today: string, firstDay: number): string {
  return isoDaysBefore(today, (weekdayOf(today) - firstDay + 7) % 7);
}

/** Calendar-week rollup: 7 days from `startIso` (the user's week start, so
 *  totals match the Garmin app), with days after today left empty. Without
 *  `startIso` it degrades to the rolling last-7-days window. */
export function weeklyRollup(
  activities: GarminActivity[], now: Date, timezone: string, startIso?: string,
): WeeklyData {
  const today = todayIso(now, timezone);
  const start = startIso ?? isoDaysBefore(today, 6);
  const days: WeeklyDay[] = [];
  for (let i = 0; i < 7; i++) {
    const key = isoDaysBefore(start, -i);
    days.push({ key, label: DAY_LETTERS[weekdayOf(key)], isToday: key === today, bySport: {}, totalSeconds: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  const totals = new Map<SportKey, SportTotal>();
  let totalSeconds = 0;
  let totalDistanceMeters = 0;
  let totalSessions = 0;

  for (const a of activities) {
    const day = byKey.get(dayOf(a.startLocal) ?? '');
    if (!day) continue; // outside the rolling window (or no start time)
    const sport = sportFor(a.typeKey).key;
    day.bySport[sport] = (day.bySport[sport] ?? 0) + a.durationSeconds;
    day.totalSeconds += a.durationSeconds;
    const t = totals.get(sport) ?? { sport, sessions: 0, distanceMeters: 0, durationSeconds: 0 };
    t.sessions += 1;
    t.distanceMeters += a.distanceMeters;
    t.durationSeconds += a.durationSeconds;
    totals.set(sport, t);
    totalSeconds += a.durationSeconds;
    totalDistanceMeters += a.distanceMeters;
    totalSessions += 1;
  }

  const sports = [...totals.values()].sort((x, y) => y.durationSeconds - x.durationSeconds);
  return { days, sports, totalSeconds, totalDistanceMeters, totalSessions };
}

/** One boolean per day for the last `days` days, oldest → newest: true when at
 *  least one activity started that day. Backs the weekly view's 4-week strip. */
export function consistencyDays(
  activities: GarminActivity[], today: string, days = 28,
): boolean[] {
  const active = new Set<string>();
  for (const a of activities) {
    const d = dayOf(a.startLocal);
    if (d) active.add(d);
  }
  return Array.from({ length: days }, (_, i) => active.has(isoDaysBefore(today, days - 1 - i)));
}

/** "Today" / "Yesterday" / "Tue" (≤6 days back) / "Jul 1" for list rows. */
export function relativeDay(startLocal: string | null, now: Date, timezone: string): string {
  const day = dayOf(startLocal);
  if (!day) return '';
  const today = todayIso(now, timezone);
  if (day === today) return 'Today';
  if (day === isoDaysBefore(today, 1)) return 'Yesterday';
  for (let i = 2; i <= 6; i++) {
    if (day === isoDaysBefore(today, i)) return WEEKDAY_SHORT[weekdayOf(day)];
  }
  const anchor = new Date(`${day}T12:00:00Z`);
  return `${MONTH_SHORT[anchor.getUTCMonth()]} ${anchor.getUTCDate()}`;
}
