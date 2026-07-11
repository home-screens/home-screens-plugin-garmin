export interface GarminActivity {
  id: number;
  name: string;
  typeKey: string;
  distanceMeters: number;
  durationSeconds: number;
  averageHr: number | null;
  startLocal: string | null;
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
}

export type GarminView = 'summary' | 'bodyBattery' | 'sleep' | 'activities';
export type Units = 'metric' | 'imperial';
