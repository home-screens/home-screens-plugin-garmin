/**
 * Proves the host's Text size actually reaches the rendered output.
 *
 * Before scale.tsx existed, every dimension in these views was a pixel
 * literal, so moving the host's Text size slider changed nothing at all —
 * the module rendered identically at 8 and at 72. These tests server-render
 * the same view at two font sizes and compare the pixel values that come out,
 * which is the only way to catch a regression back to hard-coded sizes: the
 * views still compile, still pass their smoke tests, and still look right at
 * the default. They just stop responding to the slider.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SizeTier, TrainingReadiness, ViewProps } from '../types';
import { ScaleProvider, makeScale, BASE_FONT_SIZE, UNSCALED } from '../scale';
import { SummaryView } from '../views/summary';
import { SleepView } from '../views/sleep';
import { TrainingReadinessView } from '../views/training-readiness';
import { EmptyState, StatTile } from '../components';

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

const READINESS: TrainingReadiness = {
  score: 65, level: 'MODERATE', feedback: 'LISTEN_TO_YOUR_BODY',
  sleepScore: 71, sleepFeedback: 'MODERATE',
  recoveryMinutes: 90, recoveryFeedback: 'GOOD',
  acuteLoad: 114, loadFeedback: 'VERY_GOOD',
  hrvWeeklyAverage: 52, hrvFeedback: 'MODERATE',
  stressHistoryFeedback: 'GOOD', sleepHistoryFeedback: 'GOOD',
};

// The box grows with the type. These views budget their layout against the
// measured box and legitimately shed content when the type outgrows it, so
// comparing a 1x box at 2x type would compare two different layouts. Scaling
// both keeps the layout decisions identical and isolates the thing under
// test: whether the dimensions themselves moved.
/** Enough of a day to exercise the ring, the tiles, and the sparkline —
 *  the empty-data path skips most of the dimensions under test. */
const DATA = {
  steps: 8214, stepGoal: 10_000, distanceMeters: 6120, intensityMinutes: 42,
  bodyBattery: 63, restingHr: 48, stress: 27, sleepScore: 82,
  calories: 2480, activeCalories: 720, floorsAscended: 12, hrv: 51,
  sleepDeep: 4200, sleepLight: 14_400, sleepRem: 5400, sleepAwake: 900,
  sleepTotalSeconds: 24_900, sleepStart: 1, sleepEnd: 2,
  restlessMoments: 9, sleepBodyBatteryChange: 38,
  bodyBatteryCurve: [{ t: 0, v: 40 }, { t: 1, v: 65 }, { t: 2, v: 63 }],
} as unknown as ViewProps['data'];

const props = (factor = 1, tier: SizeTier = 'medium'): ViewProps => ({
  data: DATA, units: 'imperial', timezone: 'America/Chicago',
  activityCount: 4, tier, width: 520 * factor, height: 640 * factor,
  sportFilter: 'all', weeklyStyle: 'bySport', weeklyWindow: 'calendar', refreshMs: 900_000,
});

function renderAt(fontSize: number, node: React.ReactNode): string {
  return renderToStaticMarkup(
    <ScaleProvider fontSize={fontSize}>{node}</ScaleProvider>,
  );
}

/** Every `font-size:Npx` in the markup, in document order. */
function fontSizes(html: string): number[] {
  return [...html.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
}

describe('scale', () => {
  it('is exactly 1 at the authored font size, so the default look is unchanged', () => {
    expect(makeScale(BASE_FONT_SIZE).factor).toBe(1);
    expect(makeScale(BASE_FONT_SIZE)(37)).toBe(37);
    expect(UNSCALED.factor).toBe(1);
  });

  it('scales linearly with the host font size', () => {
    expect(makeScale(BASE_FONT_SIZE * 2)(10)).toBe(20);
    expect(makeScale(BASE_FONT_SIZE / 2)(10)).toBe(5);
  });

  it('falls back to the authored size rather than collapsing the module', () => {
    // A hand-edited config or an older host can hand us anything.
    expect(makeScale(0)(10)).toBe(10);
    expect(makeScale(Number.NaN)(10)).toBe(10);
    expect(makeScale(-5)(10)).toBe(10);
    expect(makeScale(undefined as unknown as number)(10)).toBe(10);
  });
});

describe('views follow the host Text size', () => {
  // One case per view family: a ring+tiles layout, a budgeted stage layout,
  // and a metrics layout. If the scale gets dropped from any of them, its
  // font sizes stop moving between these two renders.
  const cases: [string, (factor: number) => React.ReactNode][] = [
    ['SummaryView', (f) => <SummaryView {...props(f)} />],
    ['SleepView', (f) => <SleepView {...props(f)} />],
    ['TrainingReadinessView', (f) => {
      cache.set('garmin:readiness', READINESS);
      return <TrainingReadinessView {...props(f)} />;
    }],
  ];

  it.each(cases)('%s grows its type with the host font size', (_name, node) => {
    const base = fontSizes(renderAt(BASE_FONT_SIZE, node(1)));
    const big = fontSizes(renderAt(BASE_FONT_SIZE * 2, node(2)));

    expect(base.length).toBeGreaterThan(0);
    expect(big.length).toBe(base.length);

    // Not an exact 2.0 for every entry, and that is correct: the ring and
    // gauge are sized to fill the box, and their labels are a fraction of
    // that diameter, so they inherit `stackGap`'s clamp (16–36px) rather than
    // the type scale. The regression this guards against is a size that does
    // not move at all — a ratio of 1.0 — which no amount of box-driven
    // clamping produces.
    base.forEach((size, i) => {
      const ratio = big[i] / size;
      expect(ratio).toBeGreaterThan(1.8);
      expect(ratio).toBeLessThan(2.2);
    });
  });

  it('scales the shared primitives too', () => {
    const small = renderToStaticMarkup(
      <ScaleProvider fontSize={BASE_FONT_SIZE}>
        <StatTile label="Resting HR" value="48" unit="bpm" />
      </ScaleProvider>,
    );
    const large = renderToStaticMarkup(
      <ScaleProvider fontSize={BASE_FONT_SIZE * 2}>
        <StatTile label="Resting HR" value="48" unit="bpm" />
      </ScaleProvider>,
    );
    fontSizes(small).forEach((size, i) => expect(fontSizes(large)[i]).toBeCloseTo(size * 2, 1));
  });

  it('scales the empty state, which is what an unconfigured module shows', () => {
    const small = renderAt(BASE_FONT_SIZE, <EmptyState title="Loading" body="Fetching..." />);
    const large = renderAt(BASE_FONT_SIZE * 2, <EmptyState title="Loading" body="Fetching..." />);
    expect(fontSizes(small)).toEqual([18, 14]);
    expect(fontSizes(large)).toEqual([36, 28]);
    // Padding and the body's max width move with it, not just the type.
    expect(small).toContain('padding:24px');
    expect(large).toContain('padding:48px');
    expect(small).toContain('max-width:320px');
    expect(large).toContain('max-width:640px');
  });

  it('keeps the geometry drawable when the type outgrows a FIXED box', () => {
    // The cases above scale the box with the type, which is what isolates
    // "did the dimensions move". It also means they cannot see the opposite
    // failure: a view whose height budget mixes scaled constants with
    // unscaled ones, or whose scaled minimum overtakes a box-derived cap.
    // Both only appear when the box holds still — the real situation, since
    // the host's Text size slider does not resize the module.
    //
    // The symptom is arithmetic that goes negative and reaches SVG, which
    // drops the element rather than complaining. `Ring`'s inner circle went
    // to r="-27" on a 300x400 box at Text size 72.
    const box = { ...props(1), width: 300, height: 400 };
    for (const fontSize of [8, 16, 24, 32, 48, 72]) {
      for (const [name, node] of [
        ['SummaryView', <SummaryView {...box} />],
        ['SleepView', <SleepView {...box} />],
        ['TrainingReadinessView', <TrainingReadinessView {...box} />],
      ] as const) {
        cache.set('garmin:readiness', READINESS);
        // Without this the summary ring has no inner circle, which is the
        // one that went negative.
        cache.set('garmin:weeklyIm', { minutes: 118, goal: 150 });
        const html = renderAt(fontSize, node);
        expect(html, `${name} @ ${fontSize}`).not.toMatch(/\br="-/);
        expect(html, `${name} @ ${fontSize}`).not.toMatch(/stroke-dasharray="-/);
        expect(html, `${name} @ ${fontSize}`).not.toMatch(/(?:width|height)="-/);
        expect(html, `${name} @ ${fontSize}`).not.toMatch(/font-size:\s*-/);
        expect(html, `${name} @ ${fontSize}`).not.toContain('NaN');
      }
    }
  });

  it('draws both of the summary ring\'s circles however large the type gets', () => {
    // The intensity ring is the piece that vanished: invalid geometry makes
    // SVG skip the element, so the view still renders and still passes its
    // smoke test with a metric silently missing.
    const box = { ...props(1), width: 300, height: 400 };
    cache.set('garmin:weeklyIm', { minutes: 118, goal: 150 });
    for (const fontSize of [16, 48, 72]) {
      const html = renderAt(fontSize, <SummaryView {...box} />);
      const radii = [...html.matchAll(/\br="([\d.-]+)"/g)].map((m) => Number(m[1]));
      expect(radii.length, `@ ${fontSize}`).toBe(4); // outer rail + fill, inner rail + fill
      radii.forEach((r) => expect(r, `@ ${fontSize}`).toBeGreaterThan(0));
    }
  });

  it('renders identically to an unscaled render at the authored size', () => {
    // Guards the "no visual change at the default" promise: the scaled render
    // at BASE must match what the views produced before scaling existed.
    const scaled = renderAt(BASE_FONT_SIZE, <SummaryView {...props(1)} />);
    const plain = renderToStaticMarkup(<SummaryView {...props(1)} />);
    expect(scaled).toBe(plain);
  });
});
