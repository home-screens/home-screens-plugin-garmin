import type { GarminData, GarminActivity } from './types';

const PLUGIN_ID = 'garmin';
export const BASE = 'https://connectapi.garmin.com';

/** Thrown when the proxy reports the Garmin connection is gone (401). */
export class AuthExpiredError extends Error {}

function pluginFetch(url: string, cacheTtlMs: number): Promise<Response> {
  const sdk = window.__HS_SDK__;
  if (!sdk) throw new Error('SDK not ready');
  return sdk.pluginFetch(PLUGIN_ID, { url, cacheTtlMs });
}

function todayIso(timezone: string): string {
  // en-CA yields YYYY-MM-DD; anchor to the display's timezone.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

export async function getJson<T>(url: string, cacheTtlMs: number): Promise<T | null> {
  const res = await pluginFetch(url, cacheTtlMs);
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** The display name keys several endpoints; cache it for the tab's lifetime. */
let cachedDisplayName: string | null = null;
export async function getDisplayName(): Promise<string | null> {
  if (cachedDisplayName) return cachedDisplayName;
  const profile = await getJson<{ displayName?: string }>(
    `${BASE}/userprofile-service/socialProfile`,
    3_600_000,
  );
  cachedDisplayName = profile?.displayName ?? null;
  return cachedDisplayName;
}

export function listCacheTtl(refreshMs: number): number {
  return Math.max(60_000, Math.min(refreshMs, 900_000));
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** The user's "first day of week" Connect setting as a JS weekday index
 *  (0 = Sunday). Falls back to Monday (Garmin's default) when unavailable.
 *  Cached for the tab's lifetime — it effectively never changes. */
let cachedFirstDay: number | null = null;
export async function getFirstDayOfWeek(): Promise<number> {
  if (cachedFirstDay != null) return cachedFirstDay;
  const settings = await getJson<{ userData?: { firstDayOfWeek?: { dayName?: string } } }>(
    `${BASE}/userprofile-service/userprofile/user-settings`,
    3_600_000,
  );
  const name = settings?.userData?.firstDayOfWeek?.dayName?.toLowerCase();
  cachedFirstDay = DAY_INDEX[name ?? ''] ?? 1;
  return cachedFirstDay;
}

export async function fetchGarminData(
  timezone: string,
  activityCount: number,
  refreshMs: number,
): Promise<GarminData> {
  const cacheTtl = listCacheTtl(refreshMs);
  const date = todayIso(timezone);
  const displayName = await getDisplayName();

  const [summary, sleep, battery, activities, stress] = await Promise.all([
    displayName
      ? getJson<RawSummary>(
          `${BASE}/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}?calendarDate=${date}`,
          cacheTtl,
        )
      : Promise.resolve(null),
    displayName
      ? getJson<RawSleep>(
          `${BASE}/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}?date=${date}&nonSleepBufferMinutes=60`,
          cacheTtl,
        )
      : Promise.resolve(null),
    getJson<RawBattery[]>(
      `${BASE}/wellness-service/wellness/bodyBattery/reports/daily?startDate=${date}&endDate=${date}`,
      cacheTtl,
    ),
    getJson<RawActivity[]>(
      `${BASE}/activitylist-service/activities/search/activities?start=0&limit=${activityCount}`,
      cacheTtl,
    ),
    getJson<RawStress>(
      `${BASE}/wellness-service/wellness/dailyStress/${date}`,
      cacheTtl,
    ),
  ]);

  return normalize(summary, sleep, battery, activities, stress);
}

/** Activities in [startDate, endDate] (ISO dates, inclusive) for the weekly view.
 *  Same endpoint and TTL policy as the daily list. Null on non-OK. */
export async function fetchActivitiesRange(
  startDate: string,
  endDate: string,
  refreshMs: number,
  limit = 50,
): Promise<GarminActivity[] | null> {
  const raw = await getJson<RawActivity[]>(
    `${BASE}/activitylist-service/activities/search/activities?startDate=${startDate}&endDate=${endDate}&start=0&limit=${limit}`,
    listCacheTtl(refreshMs),
  );
  return raw ? normalizeActivities(raw) : null;
}

// --- Raw response shapes (subset of fields we use) ---
interface RawSummary {
  totalSteps?: number;
  dailyStepGoal?: number;
  totalKilocalories?: number;
  restingHeartRate?: number;
  averageStressLevel?: number;
  bodyBatteryMostRecentValue?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryLowestValue?: number;
  activeKilocalories?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  intensityMinutesGoal?: number;
  floorsAscended?: number;
  totalDistanceMeters?: number;
}
interface RawSleep {
  dailySleepDTO?: {
    sleepTimeSeconds?: number;
    deepSleepSeconds?: number;
    lightSleepSeconds?: number;
    remSleepSeconds?: number;
    awakeSleepSeconds?: number;
    sleepStartTimestampLocal?: number;
    sleepEndTimestampLocal?: number;
    sleepScores?: { overall?: { value?: number } };
  };
  avgOvernightHrv?: number;
  restlessMomentsCount?: number;
  bodyBatteryChange?: number;
}
interface RawBattery {
  charged?: number;
  drained?: number;
  bodyBatteryValuesArray?: [number, number | null][]; // [epochMs, value]
}
interface RawActivity {
  activityId?: number;
  activityName?: string;
  activityType?: { typeKey?: string };
  distance?: number; // meters
  duration?: number; // seconds
  averageHR?: number;
  startTimeLocal?: string;
  averageSpeed?: number; // m/s
  elevationGain?: number;
  calories?: number;
  avgPower?: number | null;
  averageRunningCadenceInStepsPerMinute?: number;
  averageBikingCadenceInRevPerMinute?: number;
}
interface RawStress {
  // [epochMs, value]; -1/-2 mean "not measured" and are filtered out.
  stressValuesArray?: [number, number][];
}

export function normalizeActivities(activities: RawActivity[]): GarminActivity[] {
  return activities.map((a) => ({
    id: a.activityId ?? 0,
    name: a.activityName ?? 'Activity',
    typeKey: a.activityType?.typeKey ?? 'other',
    distanceMeters: a.distance ?? 0,
    durationSeconds: a.duration ?? 0,
    averageHr: a.averageHR ?? null,
    startLocal: a.startTimeLocal ?? null,
    averageSpeed: a.averageSpeed ?? null,
    elevationGain: a.elevationGain ?? null,
    calories: a.calories ?? null,
    avgPower: a.avgPower ?? null,
    cadence: a.averageRunningCadenceInStepsPerMinute
      ?? a.averageBikingCadenceInRevPerMinute ?? null,
  }));
}

export function normalize(
  summary: RawSummary | null,
  sleep: RawSleep | null,
  battery: RawBattery[] | null,
  activities: RawActivity[] | null,
  stress: RawStress | null,
): GarminData {
  const dto = sleep?.dailySleepDTO;
  const b = battery?.[0];
  const moderate = summary?.moderateIntensityMinutes;
  const vigorous = summary?.vigorousIntensityMinutes;
  const intensityMinutes =
    moderate == null && vigorous == null ? null : (moderate ?? 0) + 2 * (vigorous ?? 0);

  return {
    steps: summary?.totalSteps ?? null,
    stepGoal: summary?.dailyStepGoal ?? null,
    calories: summary?.totalKilocalories ?? null,
    restingHr: summary?.restingHeartRate ?? null,
    stress: summary?.averageStressLevel ?? null,
    bodyBattery: summary?.bodyBatteryMostRecentValue ?? null,
    bodyBatteryHigh: summary?.bodyBatteryHighestValue ?? null,
    bodyBatteryLow: summary?.bodyBatteryLowestValue ?? null,
    bodyBatteryCharged: b?.charged ?? null,
    bodyBatteryDrained: b?.drained ?? null,
    bodyBatteryCurve: (b?.bodyBatteryValuesArray ?? [])
      .filter((p): p is [number, number] => p[1] != null)
      .map(([t, v]) => ({ t, v })),
    sleepScore: dto?.sleepScores?.overall?.value ?? null,
    sleepTotalSeconds: dto?.sleepTimeSeconds ?? null,
    sleepDeep: dto?.deepSleepSeconds ?? null,
    sleepLight: dto?.lightSleepSeconds ?? null,
    sleepRem: dto?.remSleepSeconds ?? null,
    sleepAwake: dto?.awakeSleepSeconds ?? null,
    sleepStart: dto?.sleepStartTimestampLocal ?? null,
    sleepEnd: dto?.sleepEndTimestampLocal ?? null,
    activities: normalizeActivities(activities ?? []),
    intensityMinutes,
    intensityMinutesGoal: summary?.intensityMinutesGoal ?? null,
    activeCalories: summary?.activeKilocalories ?? null,
    // Garmin reports fractional floors (barometer-derived); display whole ones.
    floorsAscended: summary?.floorsAscended != null ? Math.round(summary.floorsAscended) : null,
    distanceMeters: summary?.totalDistanceMeters ?? null,
    hrv: sleep?.avgOvernightHrv ?? null,
    restlessMoments: sleep?.restlessMomentsCount ?? null,
    sleepBodyBatteryChange: sleep?.bodyBatteryChange ?? null,
    stressCurve: (stress?.stressValuesArray ?? [])
      .filter(([, v]) => v >= 0)
      .map(([t, v]) => ({ t, v })),
  };
}
