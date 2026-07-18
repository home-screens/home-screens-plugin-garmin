/** Layout regression check for the metric views: renders each view at a
 *  matrix of real module sizes in Chromium, then measures vertical dead
 *  space and overflow inside every module box.
 *
 *  Run: npm run test:layout          (screenshots land in scripts/.shots/)
 *  Fails when content overflows the box or dead space exceeds the budget.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';

// ─── Fixtures (shapes match captured Garmin responses) ─────────────
const READINESS = {
  score: 55, level: 'MODERATE', feedback: 'GOOD_RECOVERY',
  sleepScore: 70, sleepFeedback: 'MODERATE',
  recoveryMinutes: 202, recoveryFeedback: 'GOOD',
  acuteLoad: 324, loadFeedback: 'GOOD',
  hrvWeeklyAverage: 28, hrvFeedback: 'VERY_GOOD',
  stressHistoryFeedback: 'GOOD', sleepHistoryFeedback: 'POOR',
};
const STATUS = {
  status: 'PRODUCTIVE', sinceDate: '2026-06-29', trainingPaused: false,
  loadFocus: 'AEROBIC_HIGH_SHORTAGE', acwrStatus: 'OPTIMAL', acuteLoad: 324,
  weeklyLoad: 512, loadTunnelMin: 400, loadTunnelMax: 800,
  vo2Max: 46, vo2MaxCycling: 52, fitnessAge: 39,
  hrvStatus: 'BALANCED', hrvWeeklyAvg: 27, hrvLastNight: 26,
};
const HRV = {
  status: 'BALANCED', feedback: 'HRV_BALANCED_2',
  lastNight: 26, lastNight5MinHigh: 41, weeklyAvg: 27,
  balancedLow: 22, balancedUpper: 34,
  trend: Array.from({ length: 26 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    v: Math.round(27 + 6 * Math.sin(i / 3) + (i % 5) - 2),
  })),
};
const HEART_RATE = {
  resting: 58, sevenDayAvg: 55, min: 52, max: 141,
  curve: Array.from({ length: 96 }, (_, i) => ({
    t: i * 900_000,
    v: Math.round(66 + 14 * Math.sin(i / 7) + (i % 9) + (i > 60 && i < 70 ? 45 : 0)),
  })),
};

// One-sport month (the common case): rides across the last 28 days — the
// current week feeds the bars/totals, the whole span feeds the 4-week strip.
const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const WEEKLY_ACTIVITIES = [0, 1, 3, 5, 6, 9, 11, 14, 17, 20, 23, 26].map((back, i) => ({
  id: i + 1, name: 'Ride', typeKey: 'cycling',
  distanceMeters: 29_140, durationSeconds: 4_644, averageHr: 140,
  startLocal: `${iso(Date.now() - back * day)} 06:30:00`,
  averageSpeed: 6.3, elevationGain: 200, calories: 900, avgPower: 180, cadence: 85,
}));

// A mixed recent-activity list for the list + hero views (props.data.activities).
const SPORTS = [
  ['running', 'Morning Run', 8_050, 2_640, 152, 3.05, 84, 210],
  ['cycling', 'Gravel Ride', 29_140, 4_644, 140, 6.3, 180, 200],
  ['walking', 'Evening Walk', 3_200, 2_100, 96, 1.5, null, 40],
  ['lap_swimming', 'Pool Swim', 1_500, 1_620, 128, 0.93, null, 0],
  ['strength_training', 'Strength', 0, 2_700, 118, null, null, 0],
  ['hiking', 'Trail Hike', 9_800, 7_200, 121, 1.36, null, 540],
] as const;
const ACTIVITIES = Array.from({ length: 16 }, (_, i) => {
  const [typeKey, name, dist, dur, hr, spd, pwr, elev] = SPORTS[i % SPORTS.length];
  return {
    id: 101 + i, name, typeKey,
    distanceMeters: dist, durationSeconds: dur, averageHr: hr,
    startLocal: `${iso(Date.now() - i * day)} 06:30:00`,
    averageSpeed: spd, elevationGain: elev, calories: 300 + i * 40,
    avgPower: pwr, cadence: typeKey === 'cycling' ? 85 : 168,
  };
});

// Daily-bundle fields the summary, body-battery, stress, and sleep views read.
const DATA = {
  steps: 308, stepGoal: 4220, intensityMinutes: 0, intensityMinutesGoal: 150,
  restingHr: 71, stress: 34, sleepScore: 70, activeCalories: 8, calories: 1450,
  floorsAscended: 0, distanceMeters: 322,
  maxStress: 88, stressQualifier: 'BALANCED',
  stressBreakdown: { rest: 28_800, low: 14_400, medium: 3_600, high: 900 },
  bodyBattery: 39, bodyBatteryHigh: 61, bodyBatteryLow: 12,
  bodyBatteryCharged: 27, bodyBatteryDrained: 0,
  sleepTotalSeconds: 26_760, sleepDeep: 5_400, sleepLight: 15_000,
  sleepRem: 5_160, sleepAwake: 1_200,
  sleepStart: Date.parse('2026-07-11T22:48:00Z'), sleepEnd: Date.parse('2026-07-12T06:14:00Z'),
  hrv: 42, restlessMoments: 18, sleepBodyBatteryChange: 34,
  sleepSpo2: 94.6, sleepRespiration: 14.2, sleepNeedMinutes: 480, skinTempDeviationC: -0.4,
  activities: ACTIVITIES,
  bodyBatteryCurve: Array.from({ length: 60 }, (_, i) => ({
    t: i * 900_000, v: Math.round(12 + i * 0.45),
  })),
  stressCurve: Array.from({ length: 60 }, (_, i) => ({
    t: i * 900_000, v: Math.round(30 + 18 * Math.sin(i / 4) + (i % 7)),
  })),
};

// Detail bundle for the hero's newest activity (id 101), keyed as the hook
// seeds it. All four endpoints present so the hero renders every section.
const ACTIVITY_BUNDLE = {
  detail: {
    distanceMeters: 8_050, durationSeconds: 2_640, averageHr: 152, maxHr: 174,
    averageSpeed: 3.05, elevationGain: 84, elevationLoss: 79, calories: 512,
    avgPower: 210, cadence: 168, trainingEffect: 3.4,
  },
  splits: Array.from({ length: 8 }, (_, i) => ({
    index: i + 1, distanceMeters: 1_000, durationSeconds: 322 + (i % 3) * 6,
    avgHr: 148 + (i % 5) * 3,
  })),
  zones: [
    { zoneNumber: 1, secsInZone: 180 }, { zoneNumber: 2, secsInZone: 640 },
    { zoneNumber: 3, secsInZone: 980 }, { zoneNumber: 4, secsInZone: 560 },
    { zoneNumber: 5, secsInZone: 80 },
  ],
  traces: {
    hr: Array.from({ length: 44 }, (_, i) => ({ x: i * 60, v: Math.round(132 + 22 * Math.sin(i / 6) + (i % 4)) })),
    elevation: Array.from({ length: 44 }, (_, i) => ({ x: i * 60, v: Math.round(40 + 30 * Math.sin(i / 9)) })),
  },
};

const cache = new Map<string, unknown>([
  ['garmin:readiness', READINESS],
  ['garmin:trainingStatus', STATUS],
  ['garmin:hrv', HRV],
  ['garmin:heartRate', HEART_RATE],
  ['garmin:weekly', WEEKLY_ACTIVITIES],
  ['garmin:weeklyIm', { minutes: 567, goal: 150 }],
  ['garmin:stepsStreak', 7],
  ['garmin:firstDay', 1],
  ['garmin:activity:101', ACTIVITY_BUNDLE],
  ['garmin:weight', {
    weightKg: 78.4, changeKg: 0.36, bmi: 24.2,
    trend: Array.from({ length: 14 }, (_, i) => ({
      date: iso(Date.now() - (27 - i * 2) * day),
      kg: Math.round((79.6 - i * 0.09 + (i % 3) * 0.2) * 10) / 10,
    })),
  }],
  ['garmin:racePredictions', { fiveK: 1421, tenK: 2988, half: 6603, marathon: 13911 }],
  ['garmin:records', [
    { typeId: 1, value: 263.7, date: '2026-03-14' },
    { typeId: 2, value: 447.1, date: '2026-03-14' },
    { typeId: 3, value: 1421.2, date: '2026-05-02' },
    { typeId: 4, value: 2988.7, date: '2026-04-11' },
    { typeId: 7, value: 21_098, date: '2025-10-05' },
    { typeId: 8, value: 64_371, date: '2025-08-17' },
    { typeId: 9, value: 3_097, date: '2025-08-17' },
    { typeId: 10, value: 286.08, date: '2025-09-01' },
    { typeId: 17, value: 2_012, date: '2025-07-02' },
    { typeId: 12, value: 31_240, date: '2024-06-08' },
    { typeId: 13, value: 148_315, date: '2024-06-14' },
    { typeId: 14, value: 512_240, date: '2024-06-30' },
    { typeId: 15, value: 34, date: '2024-07-04' },
    { typeId: 16, value: 3, date: '2026-07-12' },
  ]],
]);
(globalThis as Record<string, unknown>).window = {
  __HS_SDK__: {
    displayCache: {
      get: (key: string) => (cache.has(key) ? { data: cache.get(key) } : null),
      set: () => {},
    },
  },
};

const { TrainingReadinessView } = await import('../src/views/training-readiness');
const { TrainingStatusView } = await import('../src/views/training-status');
const { HrvView } = await import('../src/views/hrv');
const { HeartRateView } = await import('../src/views/heart-rate');
const { WeeklyView } = await import('../src/views/weekly');
const { BodyBatteryView } = await import('../src/views/body-battery');
const { SummaryView } = await import('../src/views/summary');
const { SleepView } = await import('../src/views/sleep');
const { ActivityListView } = await import('../src/views/activity-list');
const { ActivityHeroView } = await import('../src/views/activity-hero');
const { WeightView } = await import('../src/views/weight');
const { StressView } = await import('../src/views/stress');
const { RacePredictionsView } = await import('../src/views/race-predictions');
const { RecordsView } = await import('../src/views/records');
const { tierFor } = await import('../src/size');


// ─── Marketing shots ────────────────────────────────────────────────
// Website carousel captures: a curated set of views at one wide size with
// camera-ready daily numbers, screenshotted at 2x. Everything above this
// section is sliced verbatim from layout-check.tsx.

const W = 640;
const H = 420;
const PAD = 20;

const DATA_M = {
  ...DATA,
  steps: 8_432, stepGoal: 10_000, intensityMinutes: 118,
  restingHr: 52, stress: 28, sleepScore: 84, activeCalories: 612, calories: 2_214,
  floorsAscended: 12, distanceMeters: 6_437,
  bodyBattery: 71, bodyBatteryHigh: 78, bodyBatteryLow: 23,
  bodyBatteryCharged: 58, bodyBatteryDrained: 10,
  sleepStart: Date.parse('2026-07-12T03:37:00Z'), sleepEnd: Date.parse('2026-07-12T11:21:00Z'),
  bodyBatteryCurve: Array.from({ length: 60 }, (_, i) => ({
    t: i * 900_000,
    v: Math.max(20, Math.min(78, Math.round(23 + i * 0.95 + 4 * Math.sin(i / 5) - (i > 34 && i < 44 ? (i - 34) * 1.6 : 0)))),
  })),
};
cache.set('garmin:weeklyIm', { minutes: 118, goal: 150 });
cache.set('garmin:stepsStreak', 12);
cache.set('garmin:readiness', { ...READINESS, score: 82, level: 'HIGH', sleepScore: 84, sleepFeedback: 'GOOD' });

const SHOTS: [string, React.ComponentType<Record<string, unknown>>][] = [
  ['summary', SummaryView],
  ['body-battery', BodyBatteryView],
  ['sleep', SleepView],
  ['weekly', WeeklyView],
  ['activity-hero', ActivityHeroView],
  ['training-readiness', TrainingReadinessView],
];

let shotBoxes = '';
for (const [viewName, View] of SHOTS) {
  const cw = W - PAD * 2;
  const ch = H - PAD * 2;
  const props = {
    data: DATA_M, units: 'imperial', timezone: 'America/Chicago', activityCount: 20,
    tier: tierFor(cw, ch), width: cw, height: ch,
    sportFilter: 'all', weeklyStyle: 'bySport', weeklyWindow: 'rolling', refreshMs: 900_000,
  };
  shotBoxes += `
    <div class="module" data-view="${viewName}" style="width:${W}px;height:${H}px">
      ${renderToStaticMarkup(React.createElement(View, props))}
    </div>`;
}

const shotHtml = `<!doctype html><meta charset="utf-8"><style>
  body { background: #0d1220; margin: 0; padding: 24px; display: flex; flex-direction: column; gap: 24px;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .module { background:
      radial-gradient(130% 130% at 88% -12%, rgba(59,130,246,0.14), transparent 52%),
      radial-gradient(130% 130% at -8% 112%, rgba(34,197,94,0.08), transparent 52%),
      #0b0f1a;
    padding: ${PAD}px; box-sizing: border-box; overflow: hidden;
    color: #f1f5f9; font-size: 16px; flex-shrink: 0; }
</style>${shotBoxes}`;

const shotDir = join(import.meta.dirname, '.shots-marketing');
mkdirSync(shotDir, { recursive: true });
const shotPage = join(shotDir, 'harness.html');
writeFileSync(shotPage, shotHtml);

const shotBrowser = await chromium.launch();
const page2 = await shotBrowser.newPage({
  viewport: { width: W + 60, height: H + 60 },
  deviceScaleFactor: 2,
});
await page2.goto(`file://${shotPage}`);
for (const [viewName] of SHOTS) {
  await page2
    .locator(`[data-view="${viewName}"]`)
    .screenshot({ path: join(shotDir, `${viewName}.png`) });
}
await shotBrowser.close();
console.log(`wrote ${SHOTS.length} shots to ${shotDir}`);
process.exit(0);
