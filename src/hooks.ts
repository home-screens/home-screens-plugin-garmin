import React from 'react';
import type { ActivityDetail, GarminActivity, GarminData, SizeTier, Split, Traces, Zone } from './types';
import { fetchGarminData, fetchActivitiesRange, AuthExpiredError } from './api';
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

export interface ModuleSize { tier: SizeTier; width: number }

/** ResizeObserver on the module root, bucketed through tierFor so views see
 *  three discrete layout states. Falls back to 'medium' when ResizeObserver
 *  is unavailable (jsdom/tests — kiosk Chromium always has it). */
export function useModuleSize(): { ref: React.RefObject<HTMLDivElement | null> } & ModuleSize {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<ModuleSize>({ tier: 'medium', width: 520 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number, h: number) =>
      setSize((prev) => {
        const next = { tier: tierFor(w, h), width: Math.round(w) };
        return prev.tier === next.tier && prev.width === next.width ? prev : next;
      });
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) apply(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, tier: size.tier, width: size.width };
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
  const [state, setState] = React.useState<DetailState>({ status: 'idle' });

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

/** Rolling last-7-days activity list for the weekly view; refreshes on the
 *  same interval as the daily bundle. Seeds from displayCache for instant
 *  paint after screen rotation. */
export function useWeeklyActivities(timezone: string, refreshMs: number): WeeklyLoadState {
  const [state, setState] = React.useState<WeeklyLoadState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    const cached = window.__HS_SDK__?.displayCache.get<GarminActivity[]>(WEEKLY_CACHE_KEY);
    if (cached) setState({ status: 'ready', activities: cached.data });

    async function load() {
      try {
        const today = todayIso(new Date(), timezone);
        const acts = await fetchActivitiesRange(isoDaysBefore(today, 6), today, refreshMs);
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
