import type { GarminData, GarminActivity } from './types';

const PLUGIN_ID = 'garmin';
const BASE = 'https://connectapi.garmin.com';

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

async function getJson<T>(url: string, cacheTtlMs: number): Promise<T | null> {
  const res = await pluginFetch(url, cacheTtlMs);
  if (res.status === 401) throw new AuthExpiredError();
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** The display name keys several endpoints; cache it for the tab's lifetime. */
let cachedDisplayName: string | null = null;
async function getDisplayName(): Promise<string | null> {
  if (cachedDisplayName) return cachedDisplayName;
  const profile = await getJson<{ displayName?: string }>(
    `${BASE}/userprofile-service/socialProfile`,
    3_600_000,
  );
  cachedDisplayName = profile?.displayName ?? null;
  return cachedDisplayName;
}

export async function fetchGarminData(
  timezone: string,
  activityCount: number,
  refreshMs: number,
): Promise<GarminData> {
  const cacheTtl = Math.max(60_000, Math.min(refreshMs, 900_000));
  const date = todayIso(timezone);
  const displayName = await getDisplayName();

  const [summary, sleep, battery, activities] = await Promise.all([
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
  ]);

  return normalize(summary, sleep, battery, activities);
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
}

export function normalize(
  summary: RawSummary | null,
  sleep: RawSleep | null,
  battery: RawBattery[] | null,
  activities: RawActivity[] | null,
): GarminData {
  const dto = sleep?.dailySleepDTO;
  const b = battery?.[0];
  const acts: GarminActivity[] = (activities ?? []).map((a) => ({
    id: a.activityId ?? 0,
    name: a.activityName ?? 'Activity',
    typeKey: a.activityType?.typeKey ?? 'other',
    distanceMeters: a.distance ?? 0,
    durationSeconds: a.duration ?? 0,
    averageHr: a.averageHR ?? null,
    startLocal: a.startTimeLocal ?? null,
  }));

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
    activities: acts,
  };
}
