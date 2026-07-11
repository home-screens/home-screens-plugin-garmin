import type { GarminData } from './types';

export const PLUGIN_ID = 'garmin';

/** Keys must satisfy the host's shared-state pattern (lowercase
 *  `[a-z0-9_:.-]`) — camelCase keys are silently dropped by publishState. */
export function deriveProvidedKeys(): { key: string; label: string }[] {
  return [
    { key: 'body_battery', label: 'Body Battery level' },
    { key: 'sleep_score', label: 'Sleep score' },
    { key: 'steps', label: 'Steps today' },
  ];
}

/** Map normalized data → the string values to publish (skip nulls). */
export function stateValues(data: GarminData): Record<string, string> {
  const out: Record<string, string> = {};
  if (data.bodyBattery != null) out.body_battery = String(data.bodyBattery);
  if (data.sleepScore != null) out.sleep_score = String(data.sleepScore);
  if (data.steps != null) out.steps = String(data.steps);
  return out;
}
