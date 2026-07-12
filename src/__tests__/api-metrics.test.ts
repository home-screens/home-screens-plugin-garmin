import { describe, it, expect } from 'vitest';
import {
  normalizeHeartRate, normalizeHrv, normalizeReadiness, normalizeTrainingStatus,
  normalizeWeeklyIntensity, normalizeWeight, stepStreak,
} from '../api-metrics';
import {
  sentencePhrase, loadFocusLabel, formatShortDate, formatWeight, formatWeightDelta,
} from '../format';

// Field names mirror a captured metrics-service/trainingreadiness response.
const READINESS_ENTRY = {
  calendarDate: '2026-02-10',
  timestamp: '2026-02-10T12:20:45.0',
  level: 'MODERATE',
  feedbackShort: 'LISTEN_TO_YOUR_BODY',
  score: 65,
  sleepScore: 71,
  sleepScoreFactorFeedback: 'MODERATE',
  recoveryTime: 90,
  recoveryTimeFactorFeedback: 'GOOD',
  acwrFactorFeedback: 'VERY_GOOD',
  acuteLoad: 114,
  stressHistoryFactorFeedback: 'GOOD',
  hrvFactorFeedback: 'MODERATE',
  hrvWeeklyAverage: 52,
  sleepHistoryFactorFeedback: 'GOOD',
  inputContext: 'AFTER_WAKEUP_RESET',
};

describe('normalizeReadiness', () => {
  it('maps a snapshot into TrainingReadiness', () => {
    const r = normalizeReadiness([READINESS_ENTRY]);
    expect(r).toEqual({
      score: 65,
      level: 'MODERATE',
      feedback: 'LISTEN_TO_YOUR_BODY',
      sleepScore: 71,
      sleepFeedback: 'MODERATE',
      recoveryMinutes: 90,
      recoveryFeedback: 'GOOD',
      acuteLoad: 114,
      loadFeedback: 'VERY_GOOD',
      hrvWeeklyAverage: 52,
      hrvFeedback: 'MODERATE',
      stressHistoryFeedback: 'GOOD',
      sleepHistoryFeedback: 'GOOD',
    });
  });

  it('picks the latest snapshot regardless of array order', () => {
    const later = { ...READINESS_ENTRY, timestamp: '2026-02-10T18:05:00.0', score: 42 };
    expect(normalizeReadiness([later, READINESS_ENTRY])?.score).toBe(42);
    expect(normalizeReadiness([READINESS_ENTRY, later])?.score).toBe(42);
  });

  it('skips unscored snapshots and derives a missing level from the score', () => {
    const r = normalizeReadiness([
      { timestamp: '2026-02-10T20:00:00.0' },              // no score
      { timestamp: '2026-02-10T12:00:00.0', score: 96 },   // no level
    ]);
    expect(r?.score).toBe(96);
    expect(r?.level).toBe('PRIME');
  });

  it('returns null for empty, unscored, or missing responses', () => {
    expect(normalizeReadiness(null)).toBeNull();
    expect(normalizeReadiness([])).toBeNull();
    expect(normalizeReadiness([{ timestamp: '2026-02-10T12:00:00.0' }])).toBeNull();
  });
});

// Shape of a captured trainingstatus/aggregated response from an older watch:
// numeric status only, no feedback phrase, no acute load, no load balance.
const OLDER_WATCH_STATUS = {
  mostRecentVO2Max: {
    generic: { calendarDate: '2026-06-15', vo2MaxValue: 39.0, fitnessAge: 47 },
    cycling: null,
  },
  mostRecentTrainingLoadBalance: { metricsTrainingLoadBalanceDTOMap: null },
  mostRecentTrainingStatus: {
    latestTrainingStatusData: {
      '3982518093': {
        sinceDate: '2026-06-15',
        weeklyTrainingLoad: 391,
        trainingStatus: 4,
        timestamp: 1781578800000,
        loadTunnelMin: 330,
        loadTunnelMax: 735,
        trainingStatusFeedbackPhrase: null,
        trainingPaused: false,
        acuteTrainingLoadDTO: null,
        primaryTrainingDevice: false,
      },
    },
  },
};

const RICH_STATUS = {
  mostRecentVO2Max: {
    generic: { vo2MaxValue: 48.0, fitnessAge: 39 },
    cycling: { vo2MaxValue: 52.0 },
  },
  mostRecentTrainingLoadBalance: {
    metricsTrainingLoadBalanceDTOMap: {
      '111': { trainingBalanceFeedbackPhrase: 'ANAEROBIC_SHORTAGE_4', primaryTrainingDevice: false },
      '222': { trainingBalanceFeedbackPhrase: 'AEROBIC_HIGH_SHORTAGE_3', primaryTrainingDevice: true },
    },
  },
  mostRecentTrainingStatus: {
    latestTrainingStatusData: {
      '111': {
        trainingStatus: 3, trainingStatusFeedbackPhrase: 'UNPRODUCTIVE_1',
        timestamp: 2, primaryTrainingDevice: false,
      },
      '222': {
        sinceDate: '2026-06-21',
        trainingStatus: 7, trainingStatusFeedbackPhrase: 'PRODUCTIVE_2',
        timestamp: 1, primaryTrainingDevice: true,
        weeklyTrainingLoad: 512, loadTunnelMin: 400, loadTunnelMax: 800,
        trainingPaused: false,
        acuteTrainingLoadDTO: { acwrStatus: 'OPTIMAL', dailyTrainingLoadAcute: 351 },
      },
    },
  },
};

const HRV = {
  hrvSummary: {
    status: 'BALANCED', weeklyAvg: 42, lastNightAvg: 45,
    baseline: { balancedLow: 38, balancedUpper: 52 },
  },
};

describe('normalizeTrainingStatus', () => {
  it('maps an older watch: status word from the numeric code, nulls elsewhere', () => {
    const s = normalizeTrainingStatus(OLDER_WATCH_STATUS, null);
    expect(s).toEqual({
      status: 'MAINTAINING',
      sinceDate: '2026-06-15',
      trainingPaused: false,
      loadFocus: null,
      acwrStatus: null,
      acuteLoad: null,
      weeklyLoad: 391,
      loadTunnelMin: 330,
      loadTunnelMax: 735,
      vo2Max: 39.0,
      vo2MaxCycling: null,
      fitnessAge: 47,
      hrvStatus: null,
      hrvWeeklyAvg: null,
      hrvLastNight: null,
    });
  });

  it('prefers the primary training device and the feedback phrase, and folds in HRV', () => {
    const s = normalizeTrainingStatus(RICH_STATUS, HRV);
    expect(s?.status).toBe('PRODUCTIVE');           // primary device beats newer timestamp
    expect(s?.loadFocus).toBe('AEROBIC_HIGH_SHORTAGE');
    expect(s?.acwrStatus).toBe('OPTIMAL');
    expect(s?.acuteLoad).toBe(351);
    expect(s?.vo2Max).toBe(48.0);
    expect(s?.vo2MaxCycling).toBe(52.0);
    expect(s?.hrvStatus).toBe('BALANCED');
    expect(s?.hrvLastNight).toBe(45);
  });

  it('falls back to the newest sync when no device is primary', () => {
    const noPrimary = {
      mostRecentTrainingStatus: {
        latestTrainingStatusData: {
          a: { trainingStatus: 4, timestamp: 1, primaryTrainingDevice: false },
          b: { trainingStatus: 7, timestamp: 2, primaryTrainingDevice: false },
        },
      },
    };
    expect(normalizeTrainingStatus(noPrimary, null)?.status).toBe('PRODUCTIVE');
  });

  it('returns null when nothing usable is present', () => {
    expect(normalizeTrainingStatus(null, null)).toBeNull();
    expect(normalizeTrainingStatus({}, null)).toBeNull();
    expect(normalizeTrainingStatus(
      { mostRecentTrainingStatus: { latestTrainingStatusData: {} } }, null,
    )).toBeNull();
  });

  it('keeps HRV-only data (watch reports HRV but no status yet)', () => {
    const s = normalizeTrainingStatus({}, HRV);
    expect(s?.hrvStatus).toBe('BALANCED');
    expect(s?.status).toBeNull();
  });
});

describe('normalizeHrv', () => {
  const summary = (date: string, lastNight: number | null) => ({
    calendarDate: date, weeklyAvg: 42, lastNightAvg: lastNight, lastNight5MinHigh: 63,
    baseline: { lowUpper: 36, balancedLow: 38, balancedUpper: 52 },
    status: 'BALANCED', feedbackPhrase: 'HRV_BALANCED_2',
  });

  it('takes status from the newest day and builds the trend oldest-first', () => {
    const h = normalizeHrv({
      hrvSummaries: [summary('2026-07-11', 49), summary('2026-07-09', 44), summary('2026-07-10', null)],
    });
    expect(h?.status).toBe('BALANCED');
    expect(h?.lastNight).toBe(49);
    expect(h?.weeklyAvg).toBe(42);
    expect(h?.balancedLow).toBe(38);
    expect(h?.balancedUpper).toBe(52);
    // nights without a reading are dropped from the trend
    expect(h?.trend).toEqual([{ date: '2026-07-09', v: 44 }, { date: '2026-07-11', v: 49 }]);
  });

  it('returns null when the window is empty', () => {
    expect(normalizeHrv(null)).toBeNull();
    expect(normalizeHrv({ hrvSummaries: [] })).toBeNull();
  });
});

describe('normalizeHeartRate', () => {
  it('maps the day and drops unmeasured curve points', () => {
    const hr = normalizeHeartRate({
      restingHeartRate: 58, lastSevenDaysAvgRestingHeartRate: 55,
      minHeartRate: 56, maxHeartRate: 101,
      heartRateValues: [[1, 60], [2, null], [3, 72]],
    });
    expect(hr).toEqual({
      resting: 58, sevenDayAvg: 55, min: 56, max: 101,
      curve: [{ t: 1, v: 60 }, { t: 3, v: 72 }],
    });
  });

  it('returns null when there is neither a resting value nor a curve', () => {
    expect(normalizeHeartRate(null)).toBeNull();
    expect(normalizeHeartRate({ heartRateValues: [[1, null]] })).toBeNull();
  });
});

describe('normalizeWeeklyIntensity', () => {
  it('takes the newest week and doubles vigorous minutes', () => {
    const im = normalizeWeeklyIntensity([
      { calendarDate: '2026-06-29', weeklyGoal: 150, moderateValue: 200, vigorousValue: 50 },
      { calendarDate: '2026-07-06', weeklyGoal: 150, moderateValue: 127, vigorousValue: 220 },
    ]);
    expect(im).toEqual({ minutes: 567, goal: 150 });
  });

  it('returns null for empty or missing responses', () => {
    expect(normalizeWeeklyIntensity(null)).toBeNull();
    expect(normalizeWeeklyIntensity([])).toBeNull();
  });
});

describe('normalizeWeight', () => {
  // Field names/units mirror a captured weight-service/weight/range response:
  // one summary per weigh-in day, weight in GRAMS, bmi as a plain number.
  const summary = (date: string, grams: number | null, bmi: number | null = 22.5) => ({
    summaryDate: date,
    numOfWeightEntries: grams == null ? 0 : 1,
    latestWeight: grams == null ? null
      : { samplePk: 1, calendarDate: date, weight: grams, bmi, sourceType: 'INDEX_SCALE' },
  });

  it('takes the newest weigh-in, converts grams to kg, and builds the trend oldest-first', () => {
    const w = normalizeWeight({
      dailyWeightSummaries: [
        summary('2026-07-11', 72500, 22.4),
        summary('2026-06-20', 74000, 22.9),
        summary('2026-07-04', 73200, 22.6),
      ],
    });
    expect(w?.weightKg).toBeCloseTo(72.5, 5);
    expect(w?.bmi).toBe(22.4);
    // change is vs the previous weigh-in day (Jul 4), not the oldest.
    expect(w?.changeKg).toBeCloseTo(-0.7, 5);
    expect(w?.trend).toEqual([
      { date: '2026-06-20', kg: 74 },
      { date: '2026-07-04', kg: 73.2 },
      { date: '2026-07-11', kg: 72.5 },
    ]);
  });

  it('drops days without a weight and leaves change null for a single weigh-in', () => {
    const w = normalizeWeight({
      dailyWeightSummaries: [summary('2026-07-10', null), summary('2026-07-11', 80000, null)],
    });
    expect(w?.weightKg).toBe(80);
    expect(w?.changeKg).toBeNull();
    expect(w?.bmi).toBeNull();
    expect(w?.trend).toEqual([{ date: '2026-07-11', kg: 80 }]);
  });

  it('returns null for empty or missing responses', () => {
    expect(normalizeWeight(null)).toBeNull();
    expect(normalizeWeight({ dailyWeightSummaries: [] })).toBeNull();
    expect(normalizeWeight({ dailyWeightSummaries: [summary('2026-07-11', null)] })).toBeNull();
  });
});

describe('weight formatting', () => {
  it('formats weight in the chosen units, one decimal', () => {
    expect(formatWeight(72.5, 'metric')).toBe('72.5 kg');
    expect(formatWeight(72.5, 'imperial')).toBe('159.8 lb');
  });

  it('formats a signed change and reads a rounds-to-zero delta as unsigned', () => {
    expect(formatWeightDelta(-0.7, 'metric')).toBe('-0.7 kg');
    expect(formatWeightDelta(0.7, 'metric')).toBe('+0.7 kg');
    expect(formatWeightDelta(-0.7, 'imperial')).toBe('-1.5 lb');
    expect(formatWeightDelta(0.02, 'metric')).toBe('0.0 kg');
  });
});

describe('stepStreak', () => {
  const TODAY = '2026-07-12';
  const d = (date: string, totalSteps: number, stepGoal = 4000) => ({
    calendarDate: date, totalSteps, stepGoal,
  });

  it('counts consecutive met days back from today, breaking at the first miss', () => {
    const streak = stepStreak([
      d('2026-07-12', 5000), d('2026-07-11', 6200), d('2026-07-10', 4000),
      d('2026-07-09', 1200),                                    // miss — ends it
      d('2026-07-08', 9000),
    ], TODAY);
    expect(streak).toBe(3);
  });

  it('lets the streak end yesterday when today has not met the goal yet', () => {
    const streak = stepStreak([
      d('2026-07-12', 900),                                     // today short — neutral
      d('2026-07-11', 6200), d('2026-07-10', 4300),
      d('2026-07-09', 1200),
    ], TODAY);
    expect(streak).toBe(2);
  });

  it('counts today when it has met the goal', () => {
    const streak = stepStreak([
      d('2026-07-12', 8000), d('2026-07-11', 5000), d('2026-07-10', 1000),
    ], TODAY);
    expect(streak).toBe(2);
  });

  it('treats a missing today as neutral, not a break', () => {
    const streak = stepStreak([
      d('2026-07-11', 5000), d('2026-07-10', 5000), d('2026-07-09', 1000),
    ], TODAY);
    expect(streak).toBe(2);
  });

  it('does not count days below goal or with no goal set', () => {
    expect(stepStreak([d('2026-07-12', 4000, 0), d('2026-07-11', 4000, 0)], TODAY)).toBe(0);
    expect(stepStreak([d('2026-07-12', 3999)], TODAY)).toBe(0);
  });

  it('returns 0 for empty or missing data', () => {
    expect(stepStreak([], TODAY)).toBe(0);
    expect(stepStreak(null, TODAY)).toBe(0);
  });
});

describe('metric phrase formatting', () => {
  it('sentencePhrase lowercases and capitalizes once', () => {
    expect(sentencePhrase('LISTEN_TO_YOUR_BODY')).toBe('Listen to your body');
    expect(sentencePhrase('VERY_GOOD')).toBe('Very good');
    expect(sentencePhrase(null)).toBeNull();
  });

  it('loadFocusLabel uses Garmin word order for known phrases, title-case otherwise', () => {
    expect(loadFocusLabel('AEROBIC_HIGH_SHORTAGE')).toBe('High Aerobic Shortage');
    expect(loadFocusLabel('BALANCED')).toBe('Balanced');
    expect(loadFocusLabel('AEROBIC_EXCESS')).toBe('Aerobic Excess');
    expect(loadFocusLabel(null)).toBeNull();
  });

  it('formatShortDate keeps the calendar date stable', () => {
    expect(formatShortDate('2026-06-21')).toBe('Jun 21');
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate('not-a-date')).toBeNull();
  });
});
