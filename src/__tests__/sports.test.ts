import { describe, it, expect } from 'vitest';
import { sportFor, sportByKey, matchesFilter, metricsFor, formatMetric } from '../sports';
import type { MetricSource } from '../types';

const RUN: MetricSource = {
  distanceMeters: 5200, durationSeconds: 1800, averageHr: 148,
  averageSpeed: 2.89, elevationGain: 42, calories: 410, avgPower: null, cadence: 172,
};

describe('sportFor', () => {
  it('maps running variants', () => {
    expect(sportFor('running').key).toBe('running');
    expect(sportFor('trail_running').key).toBe('running');
    expect(sportFor('treadmill_running').key).toBe('running');
  });
  it('maps cycling variants', () => {
    expect(sportFor('road_biking').key).toBe('cycling');
    expect(sportFor('indoor_cycling').key).toBe('cycling');
  });
  it('maps swim, walk, hike, strength', () => {
    expect(sportFor('lap_swimming').key).toBe('swimming');
    expect(sportFor('walking').key).toBe('walking');
    expect(sportFor('hiking').key).toBe('hiking');
    expect(sportFor('strength_training').key).toBe('strength');
  });
  it('falls back to other', () => expect(sportFor('inline_skating').key).toBe('other'));
  it('every sport has label, color, plural, metrics', () => {
    for (const key of ['running', 'cycling', 'swimming', 'walking', 'hiking', 'strength', 'other'] as const) {
      const s = sportByKey(key);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.plural.length).toBeGreaterThan(0);
      expect(s.metrics.length).toBeGreaterThan(0);
    }
  });
});

describe('matchesFilter', () => {
  it('all matches everything', () => expect(matchesFilter('inline_skating', 'all')).toBe(true));
  it('variant keys match their sport', () => expect(matchesFilter('road_biking', 'cycling')).toBe(true));
  it('non-matching sport rejected', () => expect(matchesFilter('running', 'cycling')).toBe(false));
});

describe('metricsFor', () => {
  it('drops avgPower for power-less rides', () => {
    const ride = { ...RUN, avgPower: null };
    expect(metricsFor(sportByKey('cycling'), ride)).toEqual(
      ['speed', 'duration', 'avgHr', 'elevationGain', 'calories'],
    );
  });
  it('keeps avgPower when present', () => {
    const ride = { ...RUN, avgPower: 215 };
    expect(metricsFor(sportByKey('cycling'), ride)).toContain('avgPower');
  });
});

describe('formatMetric', () => {
  it('pace from averageSpeed', () =>
    expect(formatMetric('pace', RUN, 'metric').value).toBe('5:46 /km')); // 1000/2.89 ≈ 346s
  it('derives speed from distance/duration when averageSpeed missing', () =>
    // 5200/1800 = 2.888... m/s → same pace
    expect(formatMetric('pace', { ...RUN, averageSpeed: null }, 'metric').value).toBe('5:46 /km'));
  it('renders -- for missing values, never NaN', () => {
    expect(formatMetric('avgHr', { ...RUN, averageHr: null }, 'metric').value).toBe('--');
    expect(formatMetric('pace', { ...RUN, averageSpeed: null, distanceMeters: 0 }, 'metric').value).toBe('--');
  });
  it('formats the rest', () => {
    expect(formatMetric('duration', RUN, 'metric').value).toBe('30m');
    expect(formatMetric('distance', RUN, 'metric').value).toBe('5.20 km');
    expect(formatMetric('avgHr', RUN, 'metric').value).toBe('148 bpm');
    expect(formatMetric('elevationGain', RUN, 'metric').value).toBe('42 m');
    expect(formatMetric('cadence', RUN, 'metric').value).toBe('172 spm');
    expect(formatMetric('calories', RUN, 'metric').value).toBe('410');
    expect(formatMetric('avgPower', { ...RUN, avgPower: 215 }, 'metric').value).toBe('215 W');
  });
});
