import { describe, it, expect } from 'vitest';
import { normalizeDetail, normalizeSplits, normalizeZones, normalizeTraces } from '../api-activity';

describe('normalizeDetail', () => {
  it('maps summaryDTO', () => {
    expect(normalizeDetail({
      summaryDTO: {
        distance: 5200, duration: 1800, averageSpeed: 2.89, averageHR: 148, maxHR: 172,
        averagePower: 215, averageRunCadence: 172, elevationGain: 42, elevationLoss: 40,
        calories: 410, trainingEffect: 3.2,
      },
    })).toEqual({
      distanceMeters: 5200, durationSeconds: 1800, averageSpeed: 2.89, averageHr: 148,
      maxHr: 172, avgPower: 215, cadence: 172, elevationGain: 42, elevationLoss: 40,
      calories: 410, trainingEffect: 3.2,
    });
  });
  it('falls back to bike cadence', () => {
    const d = normalizeDetail({ summaryDTO: { averageBikingCadenceInRevPerMinute: 88 } });
    expect(d?.cadence).toBe(88);
  });
  it('null on missing summaryDTO', () => {
    expect(normalizeDetail(null)).toBeNull();
    expect(normalizeDetail({})).toBeNull();
  });
});

describe('normalizeSplits', () => {
  it('maps lapDTOs with 1-based indices', () => {
    expect(normalizeSplits({ lapDTOs: [
      { distance: 1000, duration: 292, averageHR: 145 },
      { distance: 1000, duration: 301 },
    ] })).toEqual([
      { index: 1, distanceMeters: 1000, durationSeconds: 292, avgHr: 145 },
      { index: 2, distanceMeters: 1000, durationSeconds: 301, avgHr: null },
    ]);
  });
  it('null on missing or empty laps', () => {
    expect(normalizeSplits(null)).toBeNull();
    expect(normalizeSplits({})).toBeNull();
    expect(normalizeSplits({ lapDTOs: [] })).toBeNull();
  });
});

describe('normalizeZones', () => {
  it('keeps zones 1–5 sorted', () => {
    expect(normalizeZones([
      { zoneNumber: 3, secsInZone: 600.4 }, { zoneNumber: 1, secsInZone: 120 },
      { zoneNumber: 0, secsInZone: 10 }, { zoneNumber: 6, secsInZone: 10 },
    ])).toEqual([
      { zoneNumber: 1, secsInZone: 120 }, { zoneNumber: 3, secsInZone: 600.4 },
    ]);
  });
  it('null on missing or empty', () => {
    expect(normalizeZones(null)).toBeNull();
    expect(normalizeZones([])).toBeNull();
  });
});

describe('normalizeTraces', () => {
  const DESC = [
    { metricsIndex: 0, key: 'sumDuration' },
    { metricsIndex: 1, key: 'directHeartRate' },
    { metricsIndex: 2, key: 'sumDistance' },
    { metricsIndex: 3, key: 'directElevation' },
  ];
  it('maps hr and elevation against sumDistance', () => {
    expect(normalizeTraces({
      metricDescriptors: DESC,
      activityDetailMetrics: [
        { metrics: [10, 120, 100, 250] },
        { metrics: [20, null, 200, 252] },
        { metrics: [30, 132, 300, null] },
      ],
    })).toEqual({
      hr: [{ x: 100, v: 120 }, { x: 300, v: 132 }],
      elevation: [{ x: 100, v: 250 }, { x: 200, v: 252 }],
    });
  });
  it('falls back to sumDuration when sumDistance is absent', () => {
    const t = normalizeTraces({
      metricDescriptors: [
        { metricsIndex: 0, key: 'sumDuration' },
        { metricsIndex: 1, key: 'directHeartRate' },
      ],
      activityDetailMetrics: [{ metrics: [10, 120] }, { metrics: [20, 125] }],
    });
    expect(t?.hr).toEqual([{ x: 10, v: 120 }, { x: 20, v: 125 }]);
    expect(t?.elevation).toEqual([]);
  });
  it('null when malformed or too sparse to chart', () => {
    expect(normalizeTraces(null)).toBeNull();
    expect(normalizeTraces({})).toBeNull();
    expect(normalizeTraces({ metricDescriptors: [], activityDetailMetrics: [] })).toBeNull();
    // one usable point per series is not a chart
    expect(normalizeTraces({
      metricDescriptors: [
        { metricsIndex: 0, key: 'sumDistance' }, { metricsIndex: 1, key: 'directHeartRate' },
      ],
      activityDetailMetrics: [{ metrics: [100, 120] }],
    })).toBeNull();
  });
});
