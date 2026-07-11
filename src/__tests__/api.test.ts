import { describe, it, expect } from 'vitest';
import { normalize, normalizeActivities } from '../api';

const RAW_SUMMARY = {
  totalSteps: 8421, dailyStepGoal: 10000, totalKilocalories: 2200,
  restingHeartRate: 52, averageStressLevel: 30,
  bodyBatteryMostRecentValue: 78, bodyBatteryHighestValue: 95, bodyBatteryLowestValue: 20,
  activeKilocalories: 640, moderateIntensityMinutes: 30, vigorousIntensityMinutes: 20,
  intensityMinutesGoal: 150, floorsAscended: 12, totalDistanceMeters: 6400,
};
const RAW_SLEEP = {
  dailySleepDTO: {
    sleepTimeSeconds: 27120, deepSleepSeconds: 5400, lightSleepSeconds: 14400,
    remSleepSeconds: 6000, awakeSleepSeconds: 1320,
    sleepStartTimestampLocal: 1750000000000, sleepEndTimestampLocal: 1750027120000,
    sleepScores: { overall: { value: 82 } },
  },
  avgOvernightHrv: 48, restlessMomentsCount: 21, bodyBatteryChange: 44,
};
const RAW_ACTIVITY = {
  activityId: 9, activityName: 'Morning Run', activityType: { typeKey: 'running' },
  distance: 5200, duration: 1800, averageHR: 148, startTimeLocal: '2026-07-11 06:30:00',
  averageSpeed: 2.89, elevationGain: 42, calories: 410, avgPower: null,
  averageRunningCadenceInStepsPerMinute: 172,
};

describe('normalize', () => {
  it('maps populated responses into GarminData', () => {
    const data = normalize(
      RAW_SUMMARY, RAW_SLEEP,
      [{ charged: 60, drained: 42, bodyBatteryValuesArray: [[1, 50], [2, null], [3, 55]] }],
      [RAW_ACTIVITY],
      { stressValuesArray: [[1, 25], [2, -1], [3, 40], [4, -2]] },
    );
    expect(data.steps).toBe(8421);
    expect(data.sleepScore).toBe(82);
    expect(data.bodyBatteryCurve).toEqual([{ t: 1, v: 50 }, { t: 3, v: 55 }]);
    // v2 summary fields
    expect(data.activeCalories).toBe(640);
    expect(data.intensityMinutes).toBe(70); // 30 + 2×20
    expect(data.intensityMinutesGoal).toBe(150);
    expect(data.floorsAscended).toBe(12);
    expect(data.distanceMeters).toBe(6400);
    // v2 sleep fields
    expect(data.hrv).toBe(48);
    expect(data.restlessMoments).toBe(21);
    expect(data.sleepBodyBatteryChange).toBe(44);
    // stress curve drops -1/-2 (unmeasured)
    expect(data.stressCurve).toEqual([{ t: 1, v: 25 }, { t: 3, v: 40 }]);
    // widened activity row
    expect(data.activities).toEqual([{
      id: 9, name: 'Morning Run', typeKey: 'running', distanceMeters: 5200,
      durationSeconds: 1800, averageHr: 148, startLocal: '2026-07-11 06:30:00',
      averageSpeed: 2.89, elevationGain: 42, calories: 410, avgPower: null, cadence: 172,
    }]);
  });

  it('yields nulls and empty lists when every source is missing', () => {
    const data = normalize(null, null, null, null, null);
    expect(data.steps).toBeNull();
    expect(data.sleepScore).toBeNull();
    expect(data.bodyBatteryCurve).toEqual([]);
    expect(data.activities).toEqual([]);
    expect(data.intensityMinutes).toBeNull();
    expect(data.hrv).toBeNull();
    expect(data.stressCurve).toEqual([]);
  });

  it('leaves intensityMinutes null when both components are missing', () => {
    const data = normalize({ totalSteps: 1 }, null, null, null, null);
    expect(data.intensityMinutes).toBeNull();
  });
});

describe('normalizeActivities', () => {
  it('defaults widened fields to null', () => {
    const [a] = normalizeActivities([{ activityId: 1 }]);
    expect(a.averageSpeed).toBeNull();
    expect(a.elevationGain).toBeNull();
    expect(a.calories).toBeNull();
    expect(a.avgPower).toBeNull();
    expect(a.cadence).toBeNull();
  });
});
