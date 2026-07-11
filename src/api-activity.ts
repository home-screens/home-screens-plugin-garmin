import type { ActivityDetail, Split, Zone, TracePoint, Traces } from './types';
import { getJson, BASE } from './api';

/** The proxy clamps cacheTtlMs to 1h (host route.ts). Longer per-activity
 *  memory comes from displayCache in useActivityDetail, keyed by activity id. */
const TTL = 3_600_000;

// --- Raw response shapes (subset of fields we use) ---
interface RawDetail {
  summaryDTO?: {
    distance?: number;
    duration?: number;
    averageSpeed?: number;
    averageHR?: number;
    maxHR?: number;
    averagePower?: number;
    averageRunCadence?: number;
    averageBikingCadenceInRevPerMinute?: number;
    elevationGain?: number;
    elevationLoss?: number;
    calories?: number;
    trainingEffect?: number;
  };
}
interface RawSplits {
  lapDTOs?: { distance?: number; duration?: number; averageHR?: number }[];
}
interface RawZone { zoneNumber?: number; secsInZone?: number }
interface RawTraces {
  metricDescriptors?: { metricsIndex?: number; key?: string }[];
  activityDetailMetrics?: { metrics?: (number | null)[] }[];
}

export async function fetchActivityDetail(id: number): Promise<ActivityDetail | null> {
  return normalizeDetail(await getJson<RawDetail>(`${BASE}/activity-service/activity/${id}`, TTL));
}

export async function fetchActivitySplits(id: number): Promise<Split[] | null> {
  return normalizeSplits(await getJson<RawSplits>(`${BASE}/activity-service/activity/${id}/splits`, TTL));
}

export async function fetchActivityZones(id: number): Promise<Zone[] | null> {
  return normalizeZones(await getJson<RawZone[]>(`${BASE}/activity-service/activity/${id}/hrTimeInZones`, TTL));
}

export async function fetchActivityTraces(id: number): Promise<Traces | null> {
  return normalizeTraces(await getJson<RawTraces>(
    `${BASE}/activity-service/activity/${id}/details?maxChartSize=200&maxPolylineSize=0`, TTL,
  ));
}

export function normalizeDetail(raw: RawDetail | null): ActivityDetail | null {
  const s = raw?.summaryDTO;
  if (!s) return null;
  return {
    distanceMeters: s.distance ?? 0,
    durationSeconds: s.duration ?? 0,
    averageSpeed: s.averageSpeed ?? null,
    averageHr: s.averageHR ?? null,
    maxHr: s.maxHR ?? null,
    avgPower: s.averagePower ?? null,
    cadence: s.averageRunCadence ?? s.averageBikingCadenceInRevPerMinute ?? null,
    elevationGain: s.elevationGain ?? null,
    elevationLoss: s.elevationLoss ?? null,
    calories: s.calories ?? null,
    trainingEffect: s.trainingEffect ?? null,
  };
}

export function normalizeSplits(raw: RawSplits | null): Split[] | null {
  const laps = raw?.lapDTOs;
  if (!laps || laps.length === 0) return null;
  return laps.map((l, i) => ({
    index: i + 1,
    distanceMeters: l.distance ?? 0,
    durationSeconds: l.duration ?? 0,
    avgHr: l.averageHR ?? null,
  }));
}

export function normalizeZones(raw: RawZone[] | null): Zone[] | null {
  if (!raw) return null;
  const zones = raw
    .filter((z): z is { zoneNumber: number; secsInZone?: number } =>
      z.zoneNumber != null && z.zoneNumber >= 1 && z.zoneNumber <= 5)
    .map((z) => ({ zoneNumber: z.zoneNumber, secsInZone: z.secsInZone ?? 0 }))
    .sort((a, b) => a.zoneNumber - b.zoneNumber);
  return zones.length > 0 ? zones : null;
}

/** Maps the details response via metricDescriptors: series keys directHeartRate
 *  and directElevation against x-axis sumDistance (fallback sumDuration). */
export function normalizeTraces(raw: RawTraces | null): Traces | null {
  const desc = raw?.metricDescriptors;
  const rows = raw?.activityDetailMetrics;
  if (!desc || !rows) return null;
  const idx = (key: string): number | null =>
    desc.find((d) => d.key === key)?.metricsIndex ?? null;
  const xIdx = idx('sumDistance') ?? idx('sumDuration');
  if (xIdx == null) return null;

  const pull = (vIdx: number | null): TracePoint[] => {
    if (vIdx == null) return [];
    const pts: TracePoint[] = [];
    for (const row of rows) {
      const x = row.metrics?.[xIdx];
      const v = row.metrics?.[vIdx];
      if (x != null && v != null) pts.push({ x, v });
    }
    return pts;
  };

  const hr = pull(idx('directHeartRate'));
  const elevation = pull(idx('directElevation'));
  if (hr.length < 2 && elevation.length < 2) return null; // nothing chartable
  return { hr, elevation };
}
