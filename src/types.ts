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

export type SizeTier = 'compact' | 'medium' | 'large';

export type GarminView =
  | 'summary' | 'bodyBattery' | 'sleep' | 'activities' | 'latestActivity' | 'weekly';
export type Units = 'metric' | 'imperial';

/** Weekly view's bottom section: per-sport totals or one row per workout. */
export type WeeklyStyle = 'bySport' | 'individual';

/** Props every view in src/views/ receives from the orchestrator. */
export interface ViewProps {
  data: GarminData;
  units: Units;
  timezone: string;
  activityCount: number;
  tier: SizeTier;
  width: number;          // measured content-box width, px
  sportFilter: SportFilter;
  weeklyStyle: WeeklyStyle;
  refreshMs: number;
}
