export interface GarminActivity {
  id: number;
  name: string;
  typeKey: string;
  distanceMeters: number;
  durationSeconds: number;
  averageHr: number | null;
  startLocal: string | null;
  averageSpeed: number | null;   // m/s, as Garmin reports it
  elevationGain: number | null;  // meters
  calories: number | null;
  avgPower: number | null;       // watts
  cadence: number | null;        // steps/min (run) or rpm (ride)
}

/** The fields formatMetric reads. GarminActivity satisfies it structurally;
 *  ActivityDetail extends it. Lets the hero fall back from detail → list row. */
export interface MetricSource {
  distanceMeters: number;
  durationSeconds: number;
  averageHr: number | null;
  averageSpeed: number | null;
  elevationGain: number | null;
  calories: number | null;
  avgPower: number | null;
  cadence: number | null;
}

export interface ActivityDetail extends MetricSource {
  maxHr: number | null;
  elevationLoss: number | null;
  trainingEffect: number | null; // aerobic TE, 0.0–5.0
}

export interface Split {
  index: number;          // 1-based
  distanceMeters: number;
  durationSeconds: number;
  avgHr: number | null;
}

export interface Zone {
  zoneNumber: number;     // 1–5
  secsInZone: number;
}

export interface TracePoint { x: number; v: number }

export interface Traces {
  hr: TracePoint[];
  elevation: TracePoint[];
}

export interface GarminData {
  steps: number | null;
  stepGoal: number | null;
  calories: number | null;
  restingHr: number | null;
  stress: number | null;
  bodyBattery: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  bodyBatteryCurve: { t: number; v: number }[];
  sleepScore: number | null;
  sleepTotalSeconds: number | null;
  sleepDeep: number | null;
  sleepLight: number | null;
  sleepRem: number | null;
  sleepAwake: number | null;
  sleepStart: number | null;
  sleepEnd: number | null;
  activities: GarminActivity[];
  // v2 additions
  intensityMinutes: number | null;      // moderate + 2×vigorous
  intensityMinutesGoal: number | null;
  activeCalories: number | null;
  floorsAscended: number | null;
  distanceMeters: number | null;        // total distance today
  hrv: number | null;                   // avg overnight HRV, ms
  restlessMoments: number | null;
  sleepBodyBatteryChange: number | null;
  stressCurve: { t: number; v: number }[];
}

export type SportKey =
  | 'running' | 'cycling' | 'swimming' | 'walking' | 'hiking' | 'strength' | 'other';
export type SportFilter = 'all' | Exclude<SportKey, 'other'>;

export interface WeeklyDay {
  key: string;            // "2026-07-11"
  label: string;          // day letter: "S" "M" "T" ...
  isToday: boolean;
  bySport: Partial<Record<SportKey, number>>; // seconds
  totalSeconds: number;
}

export interface SportTotal {
  sport: SportKey;
  sessions: number;
  distanceMeters: number;
  durationSeconds: number;
}

export interface WeeklyData {
  days: WeeklyDay[];      // oldest → today, always length 7
  sports: SportTotal[];   // sorted by durationSeconds desc
  totalSeconds: number;
  totalDistanceMeters: number;
  totalSessions: number;
}

/** Latest snapshot from metrics-service/metrics/trainingreadiness/{date}.
 *  Feedback fields are Garmin quality phrases (VERY_GOOD, MODERATE, ...). */
export interface TrainingReadiness {
  score: number;                        // 0–100
  level: string;                        // POOR | LOW | MODERATE | HIGH | PRIME
  feedback: string | null;              // e.g. LISTEN_TO_YOUR_BODY
  sleepScore: number | null;
  sleepFeedback: string | null;
  recoveryMinutes: number | null;       // recovery time remaining
  recoveryFeedback: string | null;
  acuteLoad: number | null;
  loadFeedback: string | null;
  hrvWeeklyAverage: number | null;      // ms
  hrvFeedback: string | null;
  stressHistoryFeedback: string | null;
  sleepHistoryFeedback: string | null;
}

/** trainingstatus/aggregated + hrv-service, folded to the primary device. */
export interface TrainingStatusInfo {
  status: string | null;                // PRODUCTIVE | MAINTAINING | ...
  sinceDate: string | null;             // "2026-06-15"
  trainingPaused: boolean;
  loadFocus: string | null;             // e.g. AEROBIC_HIGH_SHORTAGE
  acwrStatus: string | null;            // LOW | OPTIMAL | HIGH | VERY_HIGH
  acuteLoad: number | null;
  weeklyLoad: number | null;
  loadTunnelMin: number | null;
  loadTunnelMax: number | null;
  vo2Max: number | null;
  vo2MaxCycling: number | null;
  fitnessAge: number | null;
  hrvStatus: string | null;             // BALANCED | UNBALANCED | LOW | POOR
  hrvWeeklyAvg: number | null;          // ms
  hrvLastNight: number | null;          // ms
}

/** Current HRV status + 4-week nightly trend from hrv-service. All ms. */
export interface HrvStatusInfo {
  status: string | null;                // BALANCED | UNBALANCED | LOW | POOR
  feedback: string | null;
  lastNight: number | null;
  lastNight5MinHigh: number | null;
  weeklyAvg: number | null;
  balancedLow: number | null;           // balanced-range floor
  balancedUpper: number | null;
  trend: { date: string; v: number }[]; // nightly avg, oldest → newest
}

/** This week's intensity minutes vs. the weekly goal (Garmin's goal is weekly). */
export interface WeeklyIntensity {
  minutes: number;              // moderate + 2×vigorous, week to date
  goal: number | null;
}

/** Today's heart rate from wellness-service. Curve shape matches Body Battery. */
export interface HeartRateDay {
  resting: number | null;
  sevenDayAvg: number | null;           // 7-day average resting HR
  min: number | null;
  max: number | null;
  curve: { t: number; v: number }[];    // [epochMs, bpm]
}

/** Latest weigh-in + the 4-week trend from weight-service. Weights are kg
 *  here (Garmin reports grams); the view converts to the user's units. This
 *  is an opt-in view only — weight is never published to shared state. */
export interface WeightInfo {
  weightKg: number;                     // most recent weigh-in
  changeKg: number | null;              // vs the previous weigh-in day
  bmi: number | null;
  trend: { date: string; kg: number }[]; // one point per weigh-in day, oldest → newest
}

export type SizeTier = 'compact' | 'medium' | 'large';

export type GarminView =
  | 'summary' | 'bodyBattery' | 'sleep' | 'activities' | 'latestActivity' | 'weekly'
  | 'trainingReadiness' | 'trainingStatus' | 'hrv' | 'heartRate' | 'weight';
export type Units = 'metric' | 'imperial';

/** Weekly view's bottom section: per-sport totals or one row per workout. */
export type WeeklyStyle = 'bySport' | 'individual';

/** Weekly view's window: the Garmin calendar week (matches the Connect app)
 *  or a rolling last-7-days window. */
export type WeeklyWindow = 'calendar' | 'rolling';

/** Props every view in src/views/ receives from the orchestrator. */
export interface ViewProps {
  data: GarminData;
  units: Units;
  timezone: string;
  activityCount: number;
  tier: SizeTier;
  width: number;          // measured content-box width, px
  height: number;         // measured content-box height, px
  sportFilter: SportFilter;
  weeklyStyle: WeeklyStyle;
  weeklyWindow: WeeklyWindow;
  refreshMs: number;
}
