import { describe, it, expect } from 'vitest';
import { normalize } from '../api';

describe('normalize', () => {
  it('maps populated responses into GarminData', () => {
    const data = normalize(
      {
        totalSteps: 8421, dailyStepGoal: 10000, totalKilocalories: 2200,
        restingHeartRate: 52, averageStressLevel: 30,
        bodyBatteryMostRecentValue: 78, bodyBatteryHighestValue: 95, bodyBatteryLowestValue: 20,
      },
      {
        dailySleepDTO: {
          sleepTimeSeconds: 27120, deepSleepSeconds: 5400, lightSleepSeconds: 14400,
          remSleepSeconds: 6000, awakeSleepSeconds: 1320,
          sleepStartTimestampLocal: 1750000000000, sleepEndTimestampLocal: 1750027120000,
          sleepScores: { overall: { value: 82 } },
        },
      },
      [{ charged: 60, drained: 42, bodyBatteryValuesArray: [[1, 50], [2, null], [3, 55]] }],
      [{
        activityId: 9, activityName: 'Morning Run', activityType: { typeKey: 'running' },
        distance: 5200, duration: 1800, averageHR: 148, startTimeLocal: '2026-07-11 06:30:00',
      }],
    );
    expect(data.steps).toBe(8421);
    expect(data.sleepScore).toBe(82);
    expect(data.bodyBatteryCurve).toEqual([{ t: 1, v: 50 }, { t: 3, v: 55 }]);
    expect(data.activities).toEqual([{
      id: 9, name: 'Morning Run', typeKey: 'running', distanceMeters: 5200,
      durationSeconds: 1800, averageHr: 148, startLocal: '2026-07-11 06:30:00',
    }]);
  });

  it('yields nulls and empty lists when every source is missing', () => {
    const data = normalize(null, null, null, null);
    expect(data.steps).toBeNull();
    expect(data.sleepScore).toBeNull();
    expect(data.bodyBatteryCurve).toEqual([]);
    expect(data.activities).toEqual([]);
  });
});
