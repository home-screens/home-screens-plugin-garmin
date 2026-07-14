import type {
  HeartRateDay, HrvStatusInfo, PersonalRecord, RacePredictions, TrainingReadiness,
  TrainingStatusInfo, WeeklyIntensity, WeightInfo,
} from './types';
import { getJson, getDisplayName, listCacheTtl, BASE } from './api';
import { todayIso, isoDaysBefore } from './aggregate';

/** Readiness and training status move on an hours timescale; cache at least
 *  15 min regardless of the module's refresh interval (proxy clamps at 1h). */
function metricsTtl(refreshMs: number): number {
  return Math.max(900_000, Math.min(refreshMs, 3_600_000));
}

// --- Raw response shapes (subset of fields we use) ---

/** metrics-service/metrics/trainingreadiness/{date} — an array of snapshots
 *  (after-wakeup reset plus later recalculations). */
interface RawReadiness {
  timestamp?: string;            // GMT, ISO-ish "2026-02-10T12:20:45.0"
  score?: number;
  level?: string;                // POOR | LOW | MODERATE | HIGH | PRIME
  feedbackShort?: string;        // e.g. LISTEN_TO_YOUR_BODY
  sleepScore?: number;
  sleepScoreFactorFeedback?: string;
  recoveryTime?: number;         // minutes remaining
  recoveryTimeFactorFeedback?: string;
  acuteLoad?: number;
  acwrFactorFeedback?: string;
  hrvWeeklyAverage?: number;
  hrvFactorFeedback?: string;
  stressHistoryFactorFeedback?: string;
  sleepHistoryFactorFeedback?: string;
}

/** metrics-service/metrics/trainingstatus/aggregated/{date} */
interface RawAggregatedStatus {
  mostRecentVO2Max?: {
    generic?: { vo2MaxValue?: number; fitnessAge?: number } | null;
    cycling?: { vo2MaxValue?: number } | null;
  } | null;
  mostRecentTrainingLoadBalance?: {
    metricsTrainingLoadBalanceDTOMap?: Record<string, {
      trainingBalanceFeedbackPhrase?: string | null;
      primaryTrainingDevice?: boolean;
    } | null> | null;
  } | null;
  mostRecentTrainingStatus?: {
    latestTrainingStatusData?: Record<string, RawDeviceStatus | null> | null;
  } | null;
}
interface RawDeviceStatus {
  timestamp?: number;
  sinceDate?: string;
  trainingStatus?: number;
  trainingStatusFeedbackPhrase?: string | null;
  trainingPaused?: boolean;
  weeklyTrainingLoad?: number | null;
  loadTunnelMin?: number | null;
  loadTunnelMax?: number | null;
  primaryTrainingDevice?: boolean;
  acuteTrainingLoadDTO?: {
    acwrStatus?: string | null;          // LOW | OPTIMAL | HIGH | VERY_HIGH
    dailyTrainingLoadAcute?: number;
  } | null;
}

/** hrv-service/hrv/{date} */
interface RawHrv {
  hrvSummary?: RawHrvSummary | null;
}
interface RawHrvSummary {
  calendarDate?: string;
  status?: string;                       // BALANCED | UNBALANCED | LOW | POOR
  feedbackPhrase?: string;
  weeklyAvg?: number;
  lastNightAvg?: number | null;
  lastNight5MinHigh?: number | null;
  baseline?: { balancedLow?: number; balancedUpper?: number } | null;
}

/** hrv-service/hrv/daily/{start}/{end} — max 28 days per request. */
interface RawHrvRange {
  hrvSummaries?: RawHrvSummary[] | null;
}

/** wellness-service/wellness/dailyHeartRate/{displayName}?date={date} */
interface RawHeartRate {
  restingHeartRate?: number | null;
  lastSevenDaysAvgRestingHeartRate?: number | null;
  minHeartRate?: number | null;
  maxHeartRate?: number | null;
  heartRateValues?: [number, number | null][] | null;  // [epochMs, bpm]
}

/** usersummary-service/stats/im/weekly/{start}/{end} — one aggregate per
 *  calendar week (bucketed by the user's own first-day-of-week setting). */
interface RawWeeklyIm {
  calendarDate?: string;   // week start
  weeklyGoal?: number;
  moderateValue?: number;
  vigorousValue?: number;
}

/** weight-service/weight/range/{start}/{end}?includeAll=true — one summary
 *  per day that has a weigh-in (days without one are omitted). */
interface RawWeightRange {
  dailyWeightSummaries?: RawWeightSummary[] | null;
}
interface RawWeightSummary {
  summaryDate?: string;                  // "YYYY-MM-DD"
  latestWeight?: RawWeightEntry | null;  // that day's representative weigh-in
}
interface RawWeightEntry {
  weight?: number | null;                // GRAMS (divide by 1000 for kg)
  bmi?: number | null;
}

/** usersummary-service/stats/steps/daily/{start}/{end} — a flat array, one
 *  entry per calendar day in range. The endpoint caps each request at 28 days. */
interface RawStepDay {
  calendarDate?: string;                 // "YYYY-MM-DD"
  totalSteps?: number;
  stepGoal?: number;
}

/** metrics-service/metrics/racepredictions/latest/{displayName} — times in
 *  seconds; distances the model can't predict yet come back null. */
interface RawRacePredictions {
  calendarDate?: string;
  time5K?: number | null;
  time10K?: number | null;
  timeHalfMarathon?: number | null;
  timeMarathon?: number | null;
}

/** personalrecord-service/personalrecord/prs/{displayName} — one entry per
 *  current record. prStartTimeLocal is epoch ms; the Formatted twin is an
 *  ISO-ish local string. Manually assigned records can report 0/absent. */
interface RawPersonalRecord {
  typeId?: number;
  value?: number | null;
  prStartTimeLocal?: number | null;
  prStartTimeLocalFormatted?: string | null;
}

// --- Fetchers ---

export async function fetchTrainingReadiness(
  timezone: string, refreshMs: number,
): Promise<TrainingReadiness | null> {
  const date = todayIso(new Date(), timezone);
  const raw = await getJson<RawReadiness[]>(
    `${BASE}/metrics-service/metrics/trainingreadiness/${date}`, metricsTtl(refreshMs),
  );
  return normalizeReadiness(raw);
}

export async function fetchTrainingStatus(
  timezone: string, refreshMs: number,
): Promise<TrainingStatusInfo | null> {
  const date = todayIso(new Date(), timezone);
  const ttl = metricsTtl(refreshMs);
  const [status, hrv] = await Promise.all([
    getJson<RawAggregatedStatus>(
      `${BASE}/metrics-service/metrics/trainingstatus/aggregated/${date}`, ttl,
    ),
    getJson<RawHrv>(`${BASE}/hrv-service/hrv/${date}`, ttl),
  ]);
  return normalizeTrainingStatus(status, hrv);
}

/** Current HRV status plus the 4-week nightly trend, from one range request
 *  (the newest summary in the window IS the current status). */
export async function fetchHrvStatus(
  timezone: string, refreshMs: number,
): Promise<HrvStatusInfo | null> {
  const date = todayIso(new Date(), timezone);
  const raw = await getJson<RawHrvRange>(
    `${BASE}/hrv-service/hrv/daily/${isoDaysBefore(date, 27)}/${date}`, metricsTtl(refreshMs),
  );
  return normalizeHrv(raw);
}

export async function fetchHeartRate(
  timezone: string, refreshMs: number,
): Promise<HeartRateDay | null> {
  const displayName = await getDisplayName();
  if (!displayName) return null;
  const date = todayIso(new Date(), timezone);
  // Intraday data; cache like the daily bundle, not like the slow metrics.
  const raw = await getJson<RawHeartRate>(
    `${BASE}/wellness-service/wellness/dailyHeartRate/${encodeURIComponent(displayName)}?date=${date}`,
    listCacheTtl(refreshMs),
  );
  return normalizeHeartRate(raw);
}

/** This week's intensity minutes against the WEEKLY goal (Garmin's goal is
 *  per week, not per day). A 7-day range always covers the current week
 *  regardless of the user's first-day-of-week setting; the newest aggregate
 *  is the running week. */
export async function fetchWeeklyIntensity(
  timezone: string, refreshMs: number,
): Promise<WeeklyIntensity | null> {
  const date = todayIso(new Date(), timezone);
  const raw = await getJson<RawWeeklyIm[]>(
    `${BASE}/usersummary-service/stats/im/weekly/${isoDaysBefore(date, 6)}/${date}`,
    metricsTtl(refreshMs),
  );
  return normalizeWeeklyIntensity(raw);
}

/** Latest weigh-in plus the 4-week trend, from one range request. The range
 *  endpoint reports grams; the newest daily summary is the current weight. */
export async function fetchWeight(
  timezone: string, refreshMs: number,
): Promise<WeightInfo | null> {
  const date = todayIso(new Date(), timezone);
  const raw = await getJson<RawWeightRange>(
    `${BASE}/weight-service/weight/range/${isoDaysBefore(date, 27)}/${date}?includeAll=true`,
    metricsTtl(refreshMs),
  );
  return normalizeWeight(raw);
}

/** How far back the current step-goal streak is computed, and the endpoint's
 *  per-request day cap (wider ranges are rejected, so we chunk). */
const STEP_STREAK_DAYS = 60;
const STEP_RANGE_MAX = 28;

/** Current step-goal streak, computed from up to STEP_STREAK_DAYS of daily
 *  steps fetched in ≤28-day chunks. Returns null only when every request
 *  failed (so useMetricsFetch retries); a valid-but-empty window yields 0. */
export async function fetchStepsStreak(
  timezone: string, refreshMs: number,
): Promise<number | null> {
  const today = todayIso(new Date(), timezone);
  const ttl = metricsTtl(refreshMs);
  const ranges: [string, string][] = [];
  for (let back = 0; back < STEP_STREAK_DAYS; back += STEP_RANGE_MAX) {
    const end = isoDaysBefore(today, back);
    const start = isoDaysBefore(today, Math.min(back + STEP_RANGE_MAX - 1, STEP_STREAK_DAYS - 1));
    ranges.push([start, end]);
  }
  const chunks = await Promise.all(ranges.map(([start, end]) =>
    getJson<RawStepDay[]>(
      `${BASE}/usersummary-service/stats/steps/daily/${start}/${end}`, ttl,
    ),
  ));
  if (chunks.every((c) => c == null)) return null;
  return stepStreak(chunks.flatMap((c) => c ?? []), today);
}

/** Latest predicted race times. Race predictions move on a days timescale;
 *  the metrics TTL is fine. */
export async function fetchRacePredictions(
  _timezone: string, refreshMs: number,
): Promise<RacePredictions | null> {
  const displayName = await getDisplayName();
  if (!displayName) return null;
  const raw = await getJson<RawRacePredictions>(
    `${BASE}/metrics-service/metrics/racepredictions/latest/${encodeURIComponent(displayName)}`,
    metricsTtl(refreshMs),
  );
  return normalizeRacePredictions(raw);
}

/** Current personal records. Records change rarely; the metrics TTL is fine. */
export async function fetchPersonalRecords(
  _timezone: string, refreshMs: number,
): Promise<PersonalRecord[] | null> {
  const displayName = await getDisplayName();
  if (!displayName) return null;
  const raw = await getJson<RawPersonalRecord[]>(
    `${BASE}/personalrecord-service/personalrecord/prs/${encodeURIComponent(displayName)}`,
    metricsTtl(refreshMs),
  );
  return normalizePersonalRecords(raw);
}

// --- Normalizers ---

/** Consecutive days meeting the step goal, walking back from today. Today
 *  counts when its goal is met but does not break the streak when it isn't
 *  (the day may not be over yet); the first earlier day that is unmet or
 *  missing ends the streak. */
export function stepStreak(days: RawStepDay[] | null, today: string): number {
  const byDate = new Map<string, RawStepDay>();
  for (const d of days ?? []) if (d.calendarDate) byDate.set(d.calendarDate, d);
  let streak = 0;
  let cursor = today;
  for (let i = 0; i <= STEP_STREAK_DAYS; i++) {
    const d = byDate.get(cursor);
    const met = d != null && d.stepGoal != null && d.stepGoal > 0
      && d.totalSteps != null && d.totalSteps >= d.stepGoal;
    if (met) streak++;
    else if (i > 0) break;   // today unmet is neutral; an earlier gap ends it
    cursor = isoDaysBefore(cursor, 1);
  }
  return streak;
}

/** Latest snapshot wins: the device recalculates readiness through the day
 *  and the array is not guaranteed sorted. */
export function normalizeReadiness(raw: RawReadiness[] | null): TrainingReadiness | null {
  const scored = (raw ?? []).filter((r) => r.score != null);
  if (scored.length === 0) return null;
  const r = scored.reduce((a, b) => ((b.timestamp ?? '') > (a.timestamp ?? '') ? b : a));
  return {
    score: r.score as number,
    level: r.level ?? levelForScore(r.score as number),
    feedback: r.feedbackShort ?? null,
    sleepScore: r.sleepScore ?? null,
    sleepFeedback: r.sleepScoreFactorFeedback ?? null,
    recoveryMinutes: r.recoveryTime ?? null,
    recoveryFeedback: r.recoveryTimeFactorFeedback ?? null,
    acuteLoad: r.acuteLoad ?? null,
    loadFeedback: r.acwrFactorFeedback ?? null,
    hrvWeeklyAverage: r.hrvWeeklyAverage ?? null,
    hrvFeedback: r.hrvFactorFeedback ?? null,
    stressHistoryFeedback: r.stressHistoryFactorFeedback ?? null,
    sleepHistoryFeedback: r.sleepHistoryFactorFeedback ?? null,
  };
}

function levelForScore(score: number): string {
  if (score >= 95) return 'PRIME';
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'LOW';
  return 'POOR';
}

/** Older watches report the numeric code with a null feedback phrase. */
const STATUS_BY_CODE: Record<number, string> = {
  1: 'DETRAINING', 2: 'OVERREACHING', 3: 'UNPRODUCTIVE', 4: 'MAINTAINING',
  5: 'RECOVERY', 6: 'PEAKING', 7: 'PRODUCTIVE',
};

/** "PRODUCTIVE_2" → "PRODUCTIVE" (phrases carry a variant suffix). */
function statusWord(d: RawDeviceStatus): string | null {
  const phrase = d.trainingStatusFeedbackPhrase;
  if (phrase) return phrase.replace(/_\d+$/, '');
  return d.trainingStatus != null ? STATUS_BY_CODE[d.trainingStatus] ?? null : null;
}

/** Several watches can report; the primary training device wins, then the
 *  most recently synced. */
function pickDevice<T extends { primaryTrainingDevice?: boolean; timestamp?: number }>(
  map: Record<string, T | null> | null | undefined,
): T | null {
  const entries = Object.values(map ?? {}).filter((d): d is T => d != null);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => {
    if ((b.primaryTrainingDevice ? 1 : 0) !== (a.primaryTrainingDevice ? 1 : 0)) {
      return b.primaryTrainingDevice ? b : a;
    }
    return (b.timestamp ?? 0) > (a.timestamp ?? 0) ? b : a;
  });
}

export function normalizeTrainingStatus(
  raw: RawAggregatedStatus | null, hrv: RawHrv | null,
): TrainingStatusInfo | null {
  const device = pickDevice(raw?.mostRecentTrainingStatus?.latestTrainingStatusData);
  const balance = pickDevice(
    raw?.mostRecentTrainingLoadBalance?.metricsTrainingLoadBalanceDTOMap,
  );
  const vo2 = raw?.mostRecentVO2Max;
  const summary = hrv?.hrvSummary;

  const info: TrainingStatusInfo = {
    status: device ? statusWord(device) : null,
    sinceDate: device?.sinceDate ?? null,
    trainingPaused: device?.trainingPaused ?? false,
    loadFocus: balance?.trainingBalanceFeedbackPhrase?.replace(/_\d+$/, '') ?? null,
    acwrStatus: device?.acuteTrainingLoadDTO?.acwrStatus ?? null,
    acuteLoad: device?.acuteTrainingLoadDTO?.dailyTrainingLoadAcute ?? null,
    weeklyLoad: device?.weeklyTrainingLoad ?? null,
    loadTunnelMin: device?.loadTunnelMin ?? null,
    loadTunnelMax: device?.loadTunnelMax ?? null,
    vo2Max: vo2?.generic?.vo2MaxValue ?? null,
    vo2MaxCycling: vo2?.cycling?.vo2MaxValue ?? null,
    fitnessAge: vo2?.generic?.fitnessAge ?? null,
    hrvStatus: summary?.status ?? null,
    hrvWeeklyAvg: summary?.weeklyAvg ?? null,
    hrvLastNight: summary?.lastNightAvg ?? null,
  };

  const empty = info.status == null && info.vo2Max == null && info.hrvStatus == null;
  return empty ? null : info;
}

export function normalizeHrv(raw: RawHrvRange | null): HrvStatusInfo | null {
  const summaries = (raw?.hrvSummaries ?? []).filter((s) => s.calendarDate != null);
  if (summaries.length === 0) return null;
  const sorted = [...summaries].sort(
    (a, b) => (a.calendarDate as string).localeCompare(b.calendarDate as string),
  );
  const latest = sorted[sorted.length - 1];
  return {
    status: latest.status ?? null,
    feedback: latest.feedbackPhrase ?? null,
    lastNight: latest.lastNightAvg ?? null,
    lastNight5MinHigh: latest.lastNight5MinHigh ?? null,
    weeklyAvg: latest.weeklyAvg ?? null,
    balancedLow: latest.baseline?.balancedLow ?? null,
    balancedUpper: latest.baseline?.balancedUpper ?? null,
    trend: sorted
      .filter((s): s is RawHrvSummary & { lastNightAvg: number } => s.lastNightAvg != null)
      .map((s) => ({ date: s.calendarDate as string, v: s.lastNightAvg })),
  };
}

/** Null when the model has predicted nothing yet (no run history). */
export function normalizeRacePredictions(raw: RawRacePredictions | null): RacePredictions | null {
  if (!raw) return null;
  const p: RacePredictions = {
    fiveK: raw.time5K ?? null,
    tenK: raw.time10K ?? null,
    half: raw.timeHalfMarathon ?? null,
    marathon: raw.timeMarathon ?? null,
  };
  const empty = p.fiveK == null && p.tenK == null && p.half == null && p.marathon == null;
  return empty ? null : p;
}

/** Drops unusable rows (no typeId or non-positive value). The date prefers
 *  the epoch timestamp; manually assigned records report 0 there, so fall
 *  back to the formatted local string's date part, then to no date. */
export function normalizePersonalRecords(raw: RawPersonalRecord[] | null): PersonalRecord[] | null {
  if (!raw) return null;
  const records = raw
    .filter((r): r is RawPersonalRecord & { typeId: number; value: number } =>
      r.typeId != null && r.value != null && r.value > 0)
    .map((r) => ({ typeId: r.typeId, value: r.value, date: recordDate(r) }));
  return records.length > 0 ? records : null;
}

function recordDate(r: RawPersonalRecord): string | null {
  if (r.prStartTimeLocal != null && r.prStartTimeLocal > 0) {
    return new Date(r.prStartTimeLocal).toISOString().slice(0, 10);
  }
  const formatted = r.prStartTimeLocalFormatted;
  if (formatted && /^\d{4}-\d{2}-\d{2}/.test(formatted)) return formatted.slice(0, 10);
  return null;
}

export function normalizeWeeklyIntensity(raw: RawWeeklyIm[] | null): WeeklyIntensity | null {
  const weeks = (raw ?? []).filter((w) => w.calendarDate != null);
  if (weeks.length === 0) return null;
  const w = weeks.reduce((a, b) =>
    ((b.calendarDate as string) > (a.calendarDate as string) ? b : a));
  return {
    minutes: (w.moderateValue ?? 0) + 2 * (w.vigorousValue ?? 0),
    goal: w.weeklyGoal ?? null,
  };
}

export function normalizeHeartRate(raw: RawHeartRate | null): HeartRateDay | null {
  if (!raw) return null;
  const day: HeartRateDay = {
    resting: raw.restingHeartRate ?? null,
    sevenDayAvg: raw.lastSevenDaysAvgRestingHeartRate ?? null,
    min: raw.minHeartRate ?? null,
    max: raw.maxHeartRate ?? null,
    curve: (raw.heartRateValues ?? [])
      .filter((p): p is [number, number] => p[1] != null)
      .map(([t, v]) => ({ t, v })),
  };
  return day.resting == null && day.curve.length === 0 ? null : day;
}

const GRAMS_PER_KG = 1000;

/** Newest weigh-in wins; change is measured against the previous weigh-in day.
 *  Weight is grams in the API and kg here — the view converts to the user's
 *  units. Days without a weight are dropped, so a scale with only occasional
 *  entries still yields a clean trend. */
export function normalizeWeight(raw: RawWeightRange | null): WeightInfo | null {
  const withWeight = (raw?.dailyWeightSummaries ?? []).filter(
    (s): s is RawWeightSummary & { summaryDate: string; latestWeight: { weight: number } } =>
      s.summaryDate != null && s.latestWeight?.weight != null,
  );
  if (withWeight.length === 0) return null;
  const sorted = [...withWeight].sort((a, b) => a.summaryDate.localeCompare(b.summaryDate));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const latestKg = latest.latestWeight.weight / GRAMS_PER_KG;
  return {
    weightKg: latestKg,
    changeKg: prev ? latestKg - prev.latestWeight.weight / GRAMS_PER_KG : null,
    bmi: latest.latestWeight.bmi ?? null,
    trend: sorted.map((s) => ({ date: s.summaryDate, kg: s.latestWeight.weight / GRAMS_PER_KG })),
  };
}
