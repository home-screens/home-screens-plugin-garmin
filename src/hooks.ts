import React from 'react';
import type { GarminData } from './types';
import { fetchGarminData, AuthExpiredError } from './api';

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
    const cached = window.__HS_SDK__?.displayCache.get(CACHE_KEY) as GarminData | undefined;
    if (cached) setState({ status: 'ready', data: cached });

    async function load() {
      try {
        const data = await fetchGarminData(timezone, activityCount, refreshMs);
        if (cancelled) return;
        window.__HS_SDK__?.displayCache.set(CACHE_KEY, data);
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
