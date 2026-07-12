import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  HeartRateDay, HrvStatusInfo, SizeTier, TrainingReadiness, TrainingStatusInfo, ViewProps,
  WeightInfo,
} from '../types';
import { TrainingReadinessView } from '../views/training-readiness';
import { TrainingStatusView } from '../views/training-status';
import { HrvView } from '../views/hrv';
import { HeartRateView } from '../views/heart-rate';
import { WeightView } from '../views/weight';

/* Server-render exercises the full ready path (the metrics hooks seed
 * synchronously from displayCache), so a crash or "--" soup in any tier
 * fails here instead of on a wall display. Effects never run: no fetches. */

const READINESS: TrainingReadiness = {
  score: 65, level: 'MODERATE', feedback: 'LISTEN_TO_YOUR_BODY',
  sleepScore: 71, sleepFeedback: 'MODERATE',
  recoveryMinutes: 90, recoveryFeedback: 'GOOD',
  acuteLoad: 114, loadFeedback: 'VERY_GOOD',
  hrvWeeklyAverage: 52, hrvFeedback: 'MODERATE',
  stressHistoryFeedback: 'GOOD', sleepHistoryFeedback: 'GOOD',
};

const STATUS: TrainingStatusInfo = {
  status: 'PRODUCTIVE', sinceDate: '2026-06-21', trainingPaused: false,
  loadFocus: 'AEROBIC_HIGH_SHORTAGE', acwrStatus: 'OPTIMAL', acuteLoad: 351,
  weeklyLoad: 512, loadTunnelMin: 400, loadTunnelMax: 800,
  vo2Max: 48.0, vo2MaxCycling: 52.0, fitnessAge: 39,
  hrvStatus: 'BALANCED', hrvWeeklyAvg: 42, hrvLastNight: 45,
};

const cache = new Map<string, unknown>();
beforeEach(() => {
  cache.clear();
  (globalThis as Record<string, unknown>).window = {
    __HS_SDK__: {
      displayCache: {
        get: (key: string) => (cache.has(key) ? { data: cache.get(key) } : null),
        set: (key: string, data: unknown) => { cache.set(key, data); },
      },
    },
  };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

const TIERS: SizeTier[] = ['compact', 'medium', 'large'];
const TIER_HEIGHT: Record<SizeTier, number> = { compact: 380, medium: 640, large: 950 };
const props = (tier: SizeTier): ViewProps => ({
  data: {} as ViewProps['data'], units: 'imperial', timezone: 'America/Chicago',
  activityCount: 4, tier, width: 520, height: TIER_HEIGHT[tier],
  sportFilter: 'all', weeklyStyle: 'bySport', weeklyWindow: 'calendar', refreshMs: 900_000,
});
/** A short, wide box (isWide → side-by-side panes). */
const wideProps = (tier: SizeTier = 'compact'): ViewProps => ({ ...props(tier), width: 1200, height: 380 });

describe('TrainingReadinessView', () => {
  it.each(TIERS)('renders the ready state at %s tier', (tier) => {
    cache.set('garmin:readiness', READINESS);
    const html = renderToStaticMarkup(<TrainingReadinessView {...props(tier)} />);
    expect(html).toContain('65');
    expect(html).toContain('Moderate');
    expect(html).toContain('Listen to your body');
    if (tier !== 'compact') {
      expect(html).toContain('Recovery');
      expect(html).toContain('1h 30m');
    }
    if (tier === 'large') expect(html).toContain('Recent stress');
    expect(html).not.toContain('--');
  });

  it('renders the unsupported-watch message when the score is absent', () => {
    cache.set('garmin:readiness', null);
    const html = renderToStaticMarkup(<TrainingReadinessView {...props('medium')} />);
    expect(html).toContain('No readiness score yet');
  });
});

describe('TrainingStatusView', () => {
  it.each(TIERS)('renders the ready state at %s tier', (tier) => {
    cache.set('garmin:trainingStatus', STATUS);
    const html = renderToStaticMarkup(<TrainingStatusView {...props(tier)} />);
    expect(html).toContain('Productive');
    expect(html).toContain('since Jun 21');
    expect(html).toContain('High Aerobic Shortage');
    // The stat tiles are the point of the view; they render at every tier.
    expect(html).toContain('Optimal');
    expect(html).toContain('Balanced');
    expect(html).toContain('48');
    if (tier !== 'compact') {
      expect(html).toContain('optimal 400–800');
      expect(html).toContain('Fitness age');
    }
    expect(html).not.toContain('--');
  });

  it('renders side-by-side panes on a wide-short box with all stats intact', () => {
    cache.set('garmin:trainingStatus', STATUS);
    const html = renderToStaticMarkup(<TrainingStatusView {...wideProps()} />);
    expect(html).toContain('Productive');
    expect(html).toContain('High Aerobic Shortage');
    expect(html).toContain('Optimal');
    expect(html).toContain('Balanced');
    expect(html).toContain('48');
  });

  it('renders partial data without placeholders (older watch, no HRV/load focus)', () => {
    cache.set('garmin:trainingStatus', {
      ...STATUS,
      status: 'MAINTAINING', loadFocus: null, acwrStatus: null, acuteLoad: null,
      hrvStatus: null, hrvLastNight: null, vo2MaxCycling: null,
    });
    const html = renderToStaticMarkup(<TrainingStatusView {...props('large')} />);
    expect(html).toContain('Maintaining');
    expect(html).toContain('VO2 max');
    expect(html).not.toContain('Load focus');
    expect(html).not.toContain('--');
  });
});

const HRV_INFO: HrvStatusInfo = {
  status: 'BALANCED', feedback: 'HRV_BALANCED_2',
  lastNight: 49, lastNight5MinHigh: 63, weeklyAvg: 42,
  balancedLow: 38, balancedUpper: 52,
  trend: [{ date: '2026-07-09', v: 44 }, { date: '2026-07-10', v: 47 }, { date: '2026-07-11', v: 49 }],
};

describe('HrvView', () => {
  it.each(TIERS)('renders the ready state at %s tier', (tier) => {
    cache.set('garmin:hrv', HRV_INFO);
    const html = renderToStaticMarkup(<HrvView {...props(tier)} />);
    expect(html).toContain('49');
    expect(html).toContain('Balanced');
    if (tier !== 'compact') {
      expect(html).toContain('38–52 ms');
      expect(html).toContain('7d average');
    }
    if (tier === 'large') expect(html).toContain('Last 4 weeks');
    expect(html).not.toContain('--');
  });

  it('shows the balanced-range bar and tiles on a wide-short box', () => {
    cache.set('garmin:hrv', HRV_INFO);
    const html = renderToStaticMarkup(<HrvView {...wideProps()} />);
    expect(html).toContain('49');
    expect(html).toContain('38–52 ms');
    expect(html).toContain('7d average');
  });

  it('renders without a baseline band (new watch, no established range)', () => {
    cache.set('garmin:hrv', { ...HRV_INFO, balancedLow: null, balancedUpper: null });
    const html = renderToStaticMarkup(<HrvView {...props('large')} />);
    expect(html).toContain('49');
    expect(html).not.toContain('Balanced range');
    expect(html).toContain('Last 4 weeks');
  });
});

const HEART_RATE: HeartRateDay = {
  resting: 58, sevenDayAvg: 55, min: 56, max: 101,
  curve: [{ t: 1, v: 60 }, { t: 2, v: 72 }, { t: 3, v: 66 }],
};

describe('HeartRateView', () => {
  it.each(TIERS)('renders the ready state at %s tier', (tier) => {
    cache.set('garmin:heartRate', HEART_RATE);
    const html = renderToStaticMarkup(<HeartRateView {...props(tier)} />);
    expect(html).toContain('58');
    expect(html).toContain('Resting heart rate');
    expect(html).toContain('7d average');
    if (tier !== 'compact') {
      expect(html).toContain('Today');
      expect(html).toContain('101');
    }
    expect(html).not.toContain('--');
  });

  it('shows min/max tiles on a wide-short box', () => {
    cache.set('garmin:heartRate', HEART_RATE);
    const html = renderToStaticMarkup(<HeartRateView {...wideProps()} />);
    expect(html).toContain('58');
    expect(html).toContain('101');
    expect(html).toContain('Low');
  });

  it('renders the empty state when the watch reported nothing', () => {
    cache.set('garmin:heartRate', null);
    const html = renderToStaticMarkup(<HeartRateView {...props('medium')} />);
    expect(html).toContain('No heart rate yet');
  });

  it('handles a resting value with too few curve points for a chart', () => {
    cache.set('garmin:heartRate', { ...HEART_RATE, curve: [{ t: 1, v: 60 }] });
    const html = renderToStaticMarkup(<HeartRateView {...props('large')} />);
    expect(html).toContain('58');
    expect(html).not.toContain('Today');
  });
});

const WEIGHT: WeightInfo = {
  weightKg: 72.5, changeKg: -0.7, bmi: 22.4,
  trend: [{ date: '2026-06-20', kg: 74 }, { date: '2026-07-04', kg: 73.2 }, { date: '2026-07-11', kg: 72.5 }],
};

describe('WeightView', () => {
  it.each(TIERS)('renders the ready state at %s tier (imperial)', (tier) => {
    cache.set('garmin:weight', WEIGHT);
    const html = renderToStaticMarkup(<WeightView {...props(tier)} />);
    expect(html).toContain('159.8');                  // 72.5 kg → lb (props default to imperial)
    expect(html).toContain('lb');
    expect(html).toContain('since last weigh-in');
    if (tier !== 'compact') {
      expect(html).toContain('BMI');
      expect(html).toContain('22.4');
    }
    if (tier === 'large') expect(html).toContain('Last 4 weeks');
    expect(html).not.toContain('--');
  });

  it('renders the hero and change in metric units', () => {
    cache.set('garmin:weight', WEIGHT);
    const metric: ViewProps = { ...props('medium'), units: 'metric' };
    const html = renderToStaticMarkup(<WeightView {...metric} />);
    expect(html).toContain('72.5');
    expect(html).toContain('kg');
    expect(html).toContain('-0.7 kg since last weigh-in');
    expect(html).not.toContain('--');
  });

  it('renders side-by-side panes with tiles and trend on a wide-short box', () => {
    cache.set('garmin:weight', WEIGHT);
    const html = renderToStaticMarkup(<WeightView {...wideProps()} />);
    expect(html).toContain('159.8');
    expect(html).toContain('BMI');
    expect(html).toContain('Last 4 weeks');
  });

  it('renders a single weigh-in with no change, BMI, or trend', () => {
    cache.set('garmin:weight', { weightKg: 80, changeKg: null, bmi: null, trend: [{ date: '2026-07-11', kg: 80 }] });
    const html = renderToStaticMarkup(<WeightView {...props('large')} />);
    expect(html).toContain('Your latest weigh-in');
    expect(html).not.toContain('Last 4 weeks');
    expect(html).not.toContain('BMI');
    expect(html).not.toContain('--');
  });

  it('renders the empty state when there are no weigh-ins', () => {
    cache.set('garmin:weight', null);
    const html = renderToStaticMarkup(<WeightView {...props('medium')} />);
    expect(html).toContain('No weight entries yet');
  });
});
