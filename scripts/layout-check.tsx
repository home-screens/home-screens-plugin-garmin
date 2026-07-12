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

// Daily-bundle fields the summary, body-battery, and sleep views read.
const DATA = {
  steps: 308, stepGoal: 4220, intensityMinutes: 0, intensityMinutesGoal: 150,
  restingHr: 71, stress: 34, sleepScore: 70, activeCalories: 8, calories: 1450,
  floorsAscended: 0, distanceMeters: 322,
  bodyBattery: 39, bodyBatteryHigh: 61, bodyBatteryLow: 12,
  bodyBatteryCharged: 27, bodyBatteryDrained: 0,
  sleepTotalSeconds: 26_760, sleepDeep: 5_400, sleepLight: 15_000,
  sleepRem: 5_160, sleepAwake: 1_200,
  sleepStart: Date.parse('2026-07-11T22:48:00Z'), sleepEnd: Date.parse('2026-07-12T06:14:00Z'),
  hrv: 42, restlessMoments: 18, sleepBodyBatteryChange: 34,
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
const { tierFor } = await import('../src/size');

// ─── Matrix ─────────────────────────────────────────────────────────
// Outer module sizes (the host subtracts 20px padding per side).
const SIZES: [string, number, number][] = [
  ['wide-short', 1416, 520],
  ['screenshot-976x660', 976, 660],
  ['screenshot-936x536', 936, 536],
  ['screenshot-894x632', 894, 632],
  ['default-520x640', 520, 640],
  ['small-420x420', 420, 420],
  ['narrow-360x520', 360, 520],
  ['tall-640x980', 640, 980],
];
const VIEWS: [string, React.ComponentType<Record<string, unknown>>][] = [
  ['training-status', TrainingStatusView],
  ['training-readiness', TrainingReadinessView],
  ['hrv', HrvView],
  ['heart-rate', HeartRateView],
  ['weekly', WeeklyView],
  ['body-battery', BodyBatteryView],
  ['summary', SummaryView],
  ['sleep', SleepView],
  ['activity-list', ActivityListView],
  ['activity-hero', ActivityHeroView],
  ['weight', WeightView],
];
// Text-only card: at very tall sizes it has nothing more to show, so the
// dead-space budget doesn't apply there (overflow still checked).
const DEAD_SPACE_EXEMPT = new Set(['training-status@tall-640x980']);

// Dead-space budget: whitespace beyond the flex gaps, top + bottom combined.
// The status card is finite text (no chart/ring that can absorb height), so
// it gets a looser budget.
const deadBudget = (view: string, h: number) =>
  Math.max(90, h * (view === 'training-status' ? 0.4 : 0.3));

// ─── Harness page ───────────────────────────────────────────────────
let boxes = '';
for (const [viewName, View] of VIEWS) {
  for (const [sizeName, w, h] of SIZES) {
    const cw = w - 40, ch = h - 40;
    const props = {
      data: DATA, units: 'imperial', timezone: 'America/Chicago', activityCount: 20,
      tier: tierFor(cw, ch), width: cw, height: ch,
      sportFilter: 'all', weeklyStyle: 'bySport', weeklyWindow: 'calendar', refreshMs: 900_000,
    };
    boxes += `
      <div class="module" data-view="${viewName}" data-size="${sizeName}"
           style="width:${w}px;height:${h}px">
        ${renderToStaticMarkup(React.createElement(View, props))}
      </div>`;
  }
}
const html = `<!doctype html><meta charset="utf-8"><style>
  body { background: #0d1220; margin: 0; padding: 24px; display: flex; flex-direction: column; gap: 24px;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .module { background: rgba(8,10,18,0.92); border-radius: 14px; padding: 20px;
            box-sizing: border-box; overflow: hidden; color: #f1f5f9; font-size: 16px; flex-shrink: 0; }
</style>${boxes}`;

const outDir = join(import.meta.dirname, '.shots');
mkdirSync(outDir, { recursive: true });
const harnessPath = join(outDir, 'harness.html');
writeFileSync(harnessPath, html);

// ─── Measure ────────────────────────────────────────────────────────
interface Metric {
  view: string; size: string; boxH: number;
  dead: number; overflowV: number; overflowH: number;
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.goto(`file://${harnessPath}`);

const metrics: Metric[] = await page.$$eval('.module', (els) =>
  els.map((m) => {
    const inner = m.firstElementChild as HTMLElement | null;
    const kids = inner ? Array.from(inner.children) : [];
    const rects = kids.map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
    const style = getComputedStyle(m);
    const pad = parseFloat(style.paddingTop);
    const box = m.getBoundingClientRect();
    const contentTop = box.top + pad;
    const contentH = m.clientHeight - pad * 2;
    const contentW = m.clientWidth - pad * 2;
    let dead = contentH, overflowV = 0, overflowH = 0;
    if (rects.length) {
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      dead = Math.round(contentH - (bottom - top));
      overflowV = Math.round(Math.max(0, top < contentTop - 1 ? contentTop - top : 0)
        + Math.max(0, bottom - (contentTop + contentH + 1)));
      overflowH = Math.round(Math.max(0, (right - left) - contentW - 1));
    }
    return {
      view: m.dataset.view as string, size: m.dataset.size as string,
      boxH: contentH, dead, overflowV, overflowH,
    };
  }),
);

for (const [viewName] of VIEWS) {
  for (const [sizeName] of SIZES) {
    const el = page.locator(`[data-view="${viewName}"][data-size="${sizeName}"]`);
    await el.screenshot({ path: join(outDir, `${viewName}--${sizeName}.png`) });
  }
}
await browser.close();

// ─── Report ─────────────────────────────────────────────────────────
let failures = 0;
console.log('view                size                 boxH  dead  ovV  ovH  verdict');
for (const m of metrics) {
  const exempt = DEAD_SPACE_EXEMPT.has(`${m.view}@${m.size}`);
  const tooEmpty = !exempt && m.dead > deadBudget(m.view, m.boxH);
  const overflows = m.overflowV > 2 || m.overflowH > 2;
  const verdict = overflows ? 'FAIL overflow' : tooEmpty ? 'FAIL dead-space' : 'ok';
  if (verdict !== 'ok') failures++;
  console.log(
    `${m.view.padEnd(20)}${m.size.padEnd(21)}${String(m.boxH).padEnd(6)}`
    + `${String(m.dead).padEnd(6)}${String(m.overflowV).padEnd(5)}${String(m.overflowH).padEnd(5)}${verdict}`,
  );
}
console.log(failures ? `\n${failures} failing box(es)` : '\nall boxes within budget');
process.exit(failures ? 1 : 0);
