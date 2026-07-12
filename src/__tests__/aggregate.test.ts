import { describe, it, expect } from 'vitest';
import {
  consistencyDays, weeklyRollup, weekStartIso, relativeDay, todayIso, isoDaysBefore,
} from '../aggregate';
import type { GarminActivity } from '../types';

// 2026-07-11T18:00Z = 13:00 CDT — "today" in Chicago is 2026-07-11 (a Saturday).
const NOW = new Date('2026-07-11T18:00:00Z');
const TZ = 'America/Chicago';

function act(over: Partial<GarminActivity>): GarminActivity {
  return {
    id: 1, name: 'A', typeKey: 'running', distanceMeters: 5000, durationSeconds: 1800,
    averageHr: null, startLocal: '2026-07-11 06:30:00', averageSpeed: null,
    elevationGain: null, calories: null, avgPower: null, cadence: null, ...over,
  };
}

describe('todayIso / isoDaysBefore', () => {
  it('anchors today to the display timezone', () => expect(todayIso(NOW, TZ)).toBe('2026-07-11'));
  it('crosses month boundaries', () => expect(isoDaysBefore('2026-07-03', 6)).toBe('2026-06-27'));
});

describe('weeklyRollup', () => {
  it('builds a rolling 7-day window ending today', () => {
    const w = weeklyRollup([], NOW, TZ);
    expect(w.days).toHaveLength(7);
    expect(w.days[0].key).toBe('2026-07-05');
    expect(w.days[6].key).toBe('2026-07-11');
    expect(w.days[6].isToday).toBe(true);
    expect(w.days.map((d) => d.label)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('stacks sports per day and totals per sport', () => {
    const w = weeklyRollup([
      act({ id: 1, startLocal: '2026-07-11 06:30:00', durationSeconds: 1800, distanceMeters: 5000 }),
      act({ id: 2, startLocal: '2026-07-11 18:00:00', durationSeconds: 600, distanceMeters: 2000 }),
      act({ id: 3, typeKey: 'road_biking', startLocal: '2026-07-09 07:00:00', durationSeconds: 3600, distanceMeters: 30000 }),
      act({ id: 4, startLocal: '2026-07-04 07:00:00' }), // outside window — dropped
    ], NOW, TZ);
    expect(w.days[6].bySport.running).toBe(2400);
    expect(w.days[6].totalSeconds).toBe(2400);
    expect(w.days[4].bySport.cycling).toBe(3600);
    expect(w.totalSessions).toBe(3);
    expect(w.totalSeconds).toBe(6000);
    expect(w.totalDistanceMeters).toBe(37000);
    // sorted by duration desc: cycling (3600) before running (2400)
    expect(w.sports.map((s) => s.sport)).toEqual(['cycling', 'running']);
    expect(w.sports[1]).toEqual({ sport: 'running', sessions: 2, distanceMeters: 7000, durationSeconds: 2400 });
  });

  it('ignores activities with no start time', () => {
    expect(weeklyRollup([act({ startLocal: null })], NOW, TZ).totalSessions).toBe(0);
  });

  it('builds the calendar week from a start date, future days empty', () => {
    // 2026-07-11 is a Saturday; Monday-start week runs Jul 6 – Jul 12.
    const w = weeklyRollup([
      act({ id: 1, startLocal: '2026-07-06 06:30:00' }),      // week start — kept
      act({ id: 2, startLocal: '2026-07-05 06:30:00' }),      // last week — dropped
    ], NOW, TZ, '2026-07-06');
    expect(w.days[0].key).toBe('2026-07-06');
    expect(w.days[6].key).toBe('2026-07-12');                  // tomorrow, empty
    expect(w.days[5].isToday).toBe(true);
    expect(w.days.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(w.totalSessions).toBe(1);
  });
});

describe('weekStartIso', () => {
  it('finds the current week start for any first-day setting', () => {
    // 2026-07-11 is a Saturday.
    expect(weekStartIso('2026-07-11', 1)).toBe('2026-07-06'); // Monday start
    expect(weekStartIso('2026-07-11', 0)).toBe('2026-07-05'); // Sunday start
    expect(weekStartIso('2026-07-11', 6)).toBe('2026-07-11'); // Saturday start — today
  });
});

describe('consistencyDays', () => {
  it('marks days with at least one activity, oldest → newest, once per day', () => {
    const d = consistencyDays([
      act({ startLocal: '2026-07-11 06:30:00' }),   // today
      act({ startLocal: '2026-07-11 18:00:00' }),   // today again — same dot
      act({ startLocal: '2026-07-05 06:30:00' }),   // 6 days back
      act({ startLocal: '2026-05-01 06:30:00' }),   // outside 28d — ignored
      act({ startLocal: null }),                    // no start — ignored
    ], '2026-07-11');
    expect(d).toHaveLength(28);
    expect(d[27]).toBe(true);                       // today is newest
    expect(d[21]).toBe(true);                       // 6 days back
    expect(d.filter(Boolean)).toHaveLength(2);
  });

  it('is all-false with no activities', () => {
    const d = consistencyDays([], '2026-07-11');
    expect(d).toHaveLength(28);
    expect(d.filter(Boolean)).toHaveLength(0);
  });
});

describe('relativeDay', () => {
  it('today', () => expect(relativeDay('2026-07-11 06:30:00', NOW, TZ)).toBe('Today'));
  it('yesterday', () => expect(relativeDay('2026-07-10 06:30:00', NOW, TZ)).toBe('Yesterday'));
  it('within the week → short weekday', () => expect(relativeDay('2026-07-07 06:30:00', NOW, TZ)).toBe('Tue'));
  it('older → short date', () => expect(relativeDay('2026-07-01 06:30:00', NOW, TZ)).toBe('Jul 1'));
  it('null-safe', () => expect(relativeDay(null, NOW, TZ)).toBe(''));
});
