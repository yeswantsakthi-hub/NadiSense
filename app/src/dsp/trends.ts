/**
 * Per-session trends for the History screen: heart rate, temperature drift from the person's own
 * baseline, and the rhythm screen. Pure; tested.
 */
import type { SessionSummary } from '../cloud/model';
import { MIN_TEMP_SAMPLES, temperatureBaseline, temperatureDrift } from './baseline';

export interface TrendPoint {
  id: string;
  /** Session start (wall clock ms). */
  at: number;
  hr: number | null;
  spo2: number | null;
  /** Skin temperature minus the baseline, once the baseline exists. */
  driftC: number | null;
  rmssdMs: number | null;
  /** True when that session's rhythm screen flagged a possible irregular rhythm. */
  irregular: boolean;
}

/**
 * One point per session started at or after `sinceMs`, oldest first. The baseline comes from all
 * sessions (it uses the person's first sessions), so pass every session of one source.
 */
export function sessionTrend(sessions: readonly SessionSummary[], sinceMs: number): TrendPoint[] {
  const baseline = temperatureBaseline(sessions);
  return [...sessions]
    .filter((s) => s.startedAt >= sinceMs)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({
      id: s.id,
      at: s.startedAt,
      hr: s.vitals.hr,
      spo2: s.vitals.spo2,
      driftC:
        baseline.status === 'ready' && s.temp && s.temp.n >= MIN_TEMP_SAMPLES
          ? temperatureDrift(s.temp.avg, baseline.celsius)
          : null,
      rmssdMs: s.rhythm ? s.rhythm.rmssdMs : null,
      irregular: s.rhythm?.status === 'irregular',
    }));
}

/** True when at least one point has a value for the field (otherwise the chart is skipped). */
export function hasData(points: readonly TrendPoint[], field: 'hr' | 'spo2' | 'driftC' | 'rmssdMs'): boolean {
  return points.some((p) => p[field] !== null);
}
