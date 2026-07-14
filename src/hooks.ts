import React from 'react';
import type {
  ActivityDetail, GarminActivity, GarminData, HeartRateDay, HrvStatusInfo, PersonalRecord,
  RacePredictions, SizeTier, Split, Traces, TrainingReadiness, TrainingStatusInfo,
  WeeklyIntensity, WeightInfo, Zone,
} from './types';
import { fetchGarminData, fetchActivitiesRange, getFirstDayOfWeek, AuthExpiredError } from './api';
import {
  fetchHeartRate, fetchHrvStatus, fetchPersonalRecords, fetchRacePredictions, fetchStepsStreak,
  fetchTrainingReadiness, fetchTrainingStatus, fetchWeeklyIntensity, fetchWeight,
} from './api-metrics';
import {
  fetchActivityDetail, fetchActivitySplits, fetchActivityZones, fetchActivityTraces,
} from './api-activity';
import { tierFor } from './size';
import { todayIso, isoDaysBefore } from './aggregate';

const CACHE_KEY = 'garmin:data';

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: GarminData }
  | { status: 'authExpired' }
  | { status: 'error'; message: string };

export function useGarminData(
  connected: boolean, timezone: string, activityCount: number, refreshMs: number,
): LoadState {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  React.useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    // Seed from the display cache for instant paint after screen rotation.
    const cached = window.__HS_SDK__?.displayCache.get<GarminData>(CACHE_KEY);
    if (cached) setState({ status: 'ready', data: cached.data });

    async function load() {
      try {
        const data = await fetchGarminData(timezone, activityCount, refreshMs);
        if (cancelled) return;
        window.__HS_SDK__?.displayCache.set(CACHE_KEY, data, refreshMs);
        setState({ status: 'ready', data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthExpiredError) { setState({ status: 'authExpired' }); return; }
        window.__HS_SDK__?.emit({ type: 'log', level: 'error', message: `Garmin fetch failed: ${String(err)}` });
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: 'Could not reach Garmin.' }));
      }
    }
    void load();
    const id = setInterval(load, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [connected, timezone, activityCount, refreshMs]);

  return state;
}

/** Poll host connection status; re-check every 30s so a fresh sign-in
 *  appears on the display without a reload. */
export function useConnection(): boolean | null {
  const [connected, setConnected] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    async function check() {
      const getStatus = window.__HS_SDK__?.getAuthStatus;
      if (!getStatus) { if (!cancelled) setConnected(false); return; }
      const status = await getStatus('garmin');
      if (!cancelled) setConnected(status?.connected ?? false);
    }
    void check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return connected;
}

// ─── Size awareness ─────────────────────────────────────────────────

export interface ModuleSize { tier: SizeTier; width: number; height: number }

/** ResizeObserver on the module root, bucketed through tierFor so views see
 *  three discrete layout states. Falls back to 'medium' when ResizeObserver
 *  is unavailable (jsdom/tests — kiosk Chromium always has it). */
export function useModuleSize(): { ref: React.RefObject<HTMLDivElement | null> } & ModuleSize {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<ModuleSize>({ tier: 'medium', width: 520, height: 640 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number, h: number) =>
      setSize((prev) => {
        const next = { tier: tierFor(w, h), width: Math.round(w), height: Math.round(h) };
        return prev.tier === next.tier && prev.width === next.width && prev.height === next.height
          ? prev : next;
      });
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) apply(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, tier: size.tier, width: size.width, height: size.height };
}

// ─── Per-activity detail ────────────────────────────────────────────

export interface ActivityDetailBundle {
  detail: ActivityDetail | null;
  splits: Split[] | null;
  zones: Zone[] | null;
  traces: Traces | null;
}

export type DetailState =
  | { status: 'idle' }        // no activity selected yet
  | { status: 'loading' }
  | { status: 'ready'; bundle: ActivityDetailBundle }
  | { status: 'authExpired' };

const AUTH = Symbol('authExpired');

/** Fires the four detail fetchers in parallel for one activity. Each endpoint
 *  fails independently to null (a missing section renders as absent, never an
 *  error) — except 401, which surfaces as authExpired. Ready bundles are kept
 *  in displayCache keyed by activity id, so a tab fetches a given activity at
 *  most once (the proxy's 1h cache absorbs other tabs/displays). Bundles with
 *  no detail at all are NOT cached, so transient failures retry on remount. */
export function useActivityDetail(activityId: number | null): DetailState {
  // Seed from the display cache synchronously so a cached bundle paints on the
  // first frame (no idle→loading→ready flash after screen rotation).
  const [state, setState] = React.useState<DetailState>(() => {
    if (activityId == null) return { status: 'idle' };
    const cached = window.__HS_SDK__?.displayCache
      .get<ActivityDetailBundle>(`garmin:activity:${activityId}`);
    return cached ? { status: 'ready', bundle: cached.data } : { status: 'loading' };
  });

  React.useEffect(() => {
    if (activityId == null) {
      setState({ status: 'idle' });
      return;
    }
    const cacheKey = `garmin:activity:${activityId}`;
    const cached = window.__HS_SDK__?.displayCache.get<ActivityDetailBundle>(cacheKey);
    if (cached) {
      setState({ status: 'ready', bundle: cached.data });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    const settle = <T,>(p: Promise<T | null>): Promise<T | null | typeof AUTH> =>
      p.catch((err) => (err instanceof AuthExpiredError ? AUTH : null));

    void Promise.all([
      settle(fetchActivityDetail(activityId)),
      settle(fetchActivitySplits(activityId)),
      settle(fetchActivityZones(activityId)),
      settle(fetchActivityTraces(activityId)),
    ]).then(([detail, splits, zones, traces]) => {
      if (cancelled) return;
      if (detail === AUTH || splits === AUTH || zones === AUTH || traces === AUTH) {
        setState({ status: 'authExpired' });
        return;
      }
      const bundle: ActivityDetailBundle = { detail, splits, zones, traces };
      // 1h to match the proxy's cache window for these endpoints.
      if (detail) window.__HS_SDK__?.displayCache.set(cacheKey, bundle, 3_600_000);
      setState({ status: 'ready', bundle });
    });

    return () => { cancelled = true; };
  }, [activityId]);

  return state;
}

// ─── Weekly activity range ──────────────────────────────────────────

const WEEKLY_CACHE_KEY = 'garmin:weekly';

export type WeeklyLoadState =
  | { status: 'loading' }
  | { status: 'ready'; activities: GarminActivity[] }
  | { status: 'authExpired' }
  | { status: 'error' };

/** Last-28-days activity list for the weekly view: the 7-day rollup uses the
 *  tail of it and the 4-week consistency strip uses the whole window (one
 *  request; the rollup ignores out-of-window days). Refreshes on the same
 *  interval as the daily bundle. Seeds from displayCache synchronously for
 *  instant paint after screen rotation (no one-frame loading flash). */
export function useWeeklyActivities(timezone: string, refreshMs: number): WeeklyLoadState {
  const [state, setState] = React.useState<WeeklyLoadState>(() => {
    const cached = window.__HS_SDK__?.displayCache.get<GarminActivity[]>(WEEKLY_CACHE_KEY);
    return cached ? { status: 'ready', activities: cached.data } : { status: 'loading' };
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const today = todayIso(new Date(), timezone);
        const acts = await fetchActivitiesRange(isoDaysBefore(today, 27), today, refreshMs, 100);
        if (cancelled) return;
        if (acts) {
          window.__HS_SDK__?.displayCache.set(WEEKLY_CACHE_KEY, acts, refreshMs);
          setState({ status: 'ready', activities: acts });
        } else {
          setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthExpiredError) {
          setState({ status: 'authExpired' });
          return;
        }
        window.__HS_SDK__?.emit({ type: 'log', level: 'error', message: `Garmin weekly fetch failed: ${String(err)}` });
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    }
    void load();
    const id = setInterval(load, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [timezone, refreshMs]);

  return state;
}

// ─── Training metrics (readiness / status views) ────────────────────

export type MetricsLoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T | null }   // null: the watch doesn't report it
  | { status: 'authExpired' }
  | { status: 'error' };

/** Shared loader for the per-view metrics endpoints. A null fetch result is a
 *  valid ready state (device without the feature) and is NOT cached, so a
 *  transient empty response retries on the next interval. */
function useMetricsFetch<T>(
  cacheKey: string,
  fetcher: (timezone: string, refreshMs: number) => Promise<T | null>,
  timezone: string,
  refreshMs: number,
): MetricsLoadState<T> {
  // Seed from the display cache synchronously for instant paint after
  // screen rotation (no one-frame loading flash).
  const [state, setState] = React.useState<MetricsLoadState<T>>(() => {
    const cached = window.__HS_SDK__?.displayCache.get<T>(cacheKey);
    return cached ? { status: 'ready', data: cached.data } : { status: 'loading' };
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetcher(timezone, refreshMs);
        if (cancelled) return;
        if (data != null) window.__HS_SDK__?.displayCache.set(cacheKey, data, refreshMs);
        setState({ status: 'ready', data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthExpiredError) {
          setState({ status: 'authExpired' });
          return;
        }
        window.__HS_SDK__?.emit({ type: 'log', level: 'error', message: `Garmin metrics fetch failed: ${String(err)}` });
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      }
    }
    void load();
    const id = setInterval(load, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [cacheKey, timezone, refreshMs]);

  return state;
}

export function useTrainingReadiness(
  timezone: string, refreshMs: number,
): MetricsLoadState<TrainingReadiness> {
  return useMetricsFetch('garmin:readiness', fetchTrainingReadiness, timezone, refreshMs);
}

export function useTrainingStatus(
  timezone: string, refreshMs: number,
): MetricsLoadState<TrainingStatusInfo> {
  return useMetricsFetch('garmin:trainingStatus', fetchTrainingStatus, timezone, refreshMs);
}

export function useHrvStatus(
  timezone: string, refreshMs: number,
): MetricsLoadState<HrvStatusInfo> {
  return useMetricsFetch('garmin:hrv', fetchHrvStatus, timezone, refreshMs);
}

export function useHeartRate(
  timezone: string, refreshMs: number,
): MetricsLoadState<HeartRateDay> {
  return useMetricsFetch('garmin:heartRate', fetchHeartRate, timezone, refreshMs);
}

export function useWeeklyIntensity(
  timezone: string, refreshMs: number,
): MetricsLoadState<WeeklyIntensity> {
  return useMetricsFetch('garmin:weeklyIm', fetchWeeklyIntensity, timezone, refreshMs);
}

export function useWeight(
  timezone: string, refreshMs: number,
): MetricsLoadState<WeightInfo> {
  return useMetricsFetch('garmin:weight', fetchWeight, timezone, refreshMs);
}

export function useRacePredictions(
  timezone: string, refreshMs: number,
): MetricsLoadState<RacePredictions> {
  return useMetricsFetch('garmin:racePredictions', fetchRacePredictions, timezone, refreshMs);
}

export function usePersonalRecords(
  timezone: string, refreshMs: number,
): MetricsLoadState<PersonalRecord[]> {
  return useMetricsFetch('garmin:records', fetchPersonalRecords, timezone, refreshMs);
}

export function useStepsStreak(
  timezone: string, refreshMs: number,
): MetricsLoadState<number> {
  return useMetricsFetch('garmin:stepsStreak', fetchStepsStreak, timezone, refreshMs);
}

/** The user's first-day-of-week Connect setting (JS weekday index, 0 = Sun).
 *  Starts from the cached value (or Monday) and corrects itself once the
 *  settings fetch lands; failures keep the fallback silently. */
export function useFirstDayOfWeek(): number {
  const [day, setDay] = React.useState<number>(() =>
    window.__HS_SDK__?.displayCache.get<number>('garmin:firstDay')?.data ?? 1);
  React.useEffect(() => {
    let cancelled = false;
    getFirstDayOfWeek()
      .then((v) => {
        if (cancelled) return;
        window.__HS_SDK__?.displayCache.set('garmin:firstDay', v, 86_400_000);
        setDay(v);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return day;
}
