import { describe, it, expect } from 'vitest';
import { stateValues, deriveProvidedKeys } from '../shared-state';
import type { GarminData } from '../types';

const base: GarminData = {
  steps: 8421, stepGoal: 10000, calories: 2200, restingHr: 52, stress: 30,
  bodyBattery: 78, bodyBatteryHigh: 95, bodyBatteryLow: 20, bodyBatteryCharged: 60, bodyBatteryDrained: 42,
  bodyBatteryCurve: [], sleepScore: 82, sleepTotalSeconds: 27120,
  sleepDeep: 5400, sleepLight: 14400, sleepRem: 6000, sleepAwake: 1320,
  sleepStart: null, sleepEnd: null, activities: [],
  intensityMinutes: 70, intensityMinutesGoal: 150, activeCalories: 640,
  floorsAscended: 12, distanceMeters: 6400, hrv: 48, restlessMoments: 21,
  sleepBodyBatteryChange: 44, stressCurve: [],
  maxStress: 88, stressQualifier: 'BALANCED',
  stressBreakdown: { rest: 28800, low: 14400, medium: 3600, high: 900 },
  sleepSpo2: 94.6, sleepRespiration: 14.2, sleepNeedMinutes: 480, skinTempDeviationC: -0.4,
};

describe('stateValues', () => {
  it('publishes present metrics as strings', () => {
    expect(stateValues(base)).toEqual({ body_battery: '78', sleep_score: '82', steps: '8421' });
  });
  it('skips null metrics', () => {
    expect(stateValues({ ...base, bodyBattery: null, sleepScore: null })).toEqual({ steps: '8421' });
  });
});

describe('deriveProvidedKeys', () => {
  it('matches the manifest providesState keys', () => {
    expect(deriveProvidedKeys().map((k) => k.key)).toEqual(['body_battery', 'sleep_score', 'steps']);
  });
  it('only advertises host-legal key charsets', () => {
    const HOST_KEY_RE = /^[a-z0-9_:.-]{1,128}$/;
    for (const { key } of deriveProvidedKeys()) {
      expect(HOST_KEY_RE.test(`plugin:garmin:${key}`)).toBe(true);
    }
  });
});
