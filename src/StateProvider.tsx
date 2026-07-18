// Demand-driven state provider — the plugin's single shared-state publisher.
//
// The host mounts exactly one instance of this component (manifest
// `exports.stateProvider`), alive for the whole display tab regardless of
// screen rotation, and hands it `demandedKeys`: every key of this plugin's
// namespace referenced by any visibility condition, rule, or Text-module
// token on the display. Referencing a key IS what makes it publish — no
// need to keep a Garmin module instance on screen.
//
// Unlike the Home Assistant plugin's provider, there is no unbounded entity
// namespace and no push feed here: Garmin exposes exactly the three fixed
// keys `deriveProvidedKeys()` lists, from one REST bundle
// (`fetchGarminData`). So this is a single polling loop, not a two-lane
// fast/full-poll system.

import React from 'react';
import type { StateProviderProps } from './hs-plugin';
import type { ProviderHealthStatus } from './hs-sdk';
import type { GarminData } from './types';
import { useConnection } from './hooks';
import { fetchGarminData, AuthExpiredError } from './api';
import { PLUGIN_ID, deriveProvidedKeys, stateValues } from './shared-state';

/** Poll cadence — matches the visible module's default `refreshIntervalMs`.
 *  No module instance exists to override this for the provider. */
export const REFRESH_MS = 900_000;

const PROVIDED_KEYS = new Set(deriveProvidedKeys().map((k) => k.key));

/** The subset of demanded keys this provider can act on. Unknown keys
 *  (typos, or another plugin's namespace collision) are simply never
 *  published. Exported for tests. */
export function selectPublishableKeys(demandedKeys: readonly string[]): string[] {
  return demandedKeys.filter((k) => PROVIDED_KEYS.has(k));
}

/** Keys to clear: previously published but no longer in the demanded set.
 *  Used both for demand-shrink and for "connection gone" (called with an
 *  empty demanded set). Exported for tests. */
export function planClears(published: ReadonlySet<string>, demandedKeys: readonly string[]): string[] {
  const demanded = new Set(demandedKeys);
  return Array.from(published).filter((k) => !demanded.has(k));
}

type HealthOutage = { since: number };
type HealthOutcome = { ok: true } | { ok: false; message: string; at: number };

/** Decide what (if anything) to report to the host from one poll outcome,
 *  given the outage carried from the previous poll — edge-triggered so a
 *  90s poll doesn't spam the inspector every tick while unhealthy:
 *   - failure with no prior outage: open one at `at`, report not-ok.
 *   - failure with a prior outage: same `since`, report nothing again.
 *   - success after an outage: report ok once, close the outage.
 *   - success while already healthy: report nothing.
 *  Exported for tests. */
export function planHealthReport(
  prevOutage: HealthOutage | null,
  outcome: HealthOutcome,
): { report: ProviderHealthStatus | null; outage: HealthOutage | null } {
  if (outcome.ok) {
    if (prevOutage === null) return { report: null, outage: null };
    return { report: { ok: true }, outage: null };
  }
  if (prevOutage !== null) return { report: null, outage: prevOutage };
  return { report: { ok: false, message: outcome.message, since: outcome.at }, outage: { since: outcome.at } };
}

export function StateProvider({ demandedKeys }: StateProviderProps) {
  const keys = React.useMemo(() => selectPublishableKeys(demandedKeys), [demandedKeys]);
  const connected = useConnection();
  const timezone = window.__HS_SDK__?.getHostSettings().timezone ?? 'UTC';

  const publishedRef = React.useRef<Set<string>>(new Set());
  const outageRef = React.useRef<HealthOutage | null>(null);

  const reportHealth = React.useCallback((outcome: HealthOutcome) => {
    const { report, outage } = planHealthReport(outageRef.current, outcome);
    outageRef.current = outage;
    if (report) window.__HS_SDK__?.reportProviderHealth?.(PLUGIN_ID, report);
  }, []);

  const publish = React.useCallback((key: string, value: string) => {
    window.__HS_SDK__?.publishState?.(PLUGIN_ID, key, value);
    publishedRef.current.add(key);
  }, []);

  const clear = React.useCallback((key: string) => {
    window.__HS_SDK__?.clearState?.(PLUGIN_ID, key);
    publishedRef.current.delete(key);
  }, []);

  // Disconnected: any previously published value is now unverifiable.
  // Clear it outright rather than let it go stale silently.
  React.useEffect(() => {
    if (connected === false) {
      for (const key of planClears(publishedRef.current, [])) clear(key);
      outageRef.current = null;
    }
  }, [connected, clear]);

  // Demand shrink: clear keys that dropped out of the demand set.
  React.useEffect(() => {
    for (const key of planClears(publishedRef.current, keys)) clear(key);
  }, [keys, clear]);

  // Poll loop. Restarts (with an immediate tick) whenever the demand set or
  // connection state changes, so a newly referenced key publishes within
  // one poll of being added.
  React.useEffect(() => {
    if (connected !== true || keys.length === 0) return;
    let cancelled = false;
    let inflight = false;

    async function tick() {
      if (inflight || cancelled) return;
      inflight = true;
      try {
        const data: GarminData = await fetchGarminData(timezone, 1, REFRESH_MS);
        if (cancelled) return;
        reportHealth({ ok: true });
        const values = stateValues(data);
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(values, key)) publish(key, values[key]);
          else if (publishedRef.current.has(key)) clear(key);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthExpiredError) {
          for (const key of planClears(publishedRef.current, [])) clear(key);
          reportHealth({ ok: false, message: 'Garmin sign-in expired', at: Date.now() });
          return;
        }
        // Transient failure: keep last-published values, only report unhealthy.
        reportHealth({ ok: false, message: "Can't reach Garmin", at: Date.now() });
      } finally {
        inflight = false;
      }
    }

    tick();
    const timer = setInterval(tick, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [connected, keys, timezone, publish, clear, reportHealth]);

  return null;
}
