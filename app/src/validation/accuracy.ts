/**
 * Accuracy across validation sessions (Bland–Altman agreement), for the Stage 3 accuracy report.
 * One point per session: the ring's mean of trustworthy readings vs. the reference device.
 * Pure functions only; tested.
 */
import { summarize, type ValidationSession } from './model';

export type Metric = 'hr' | 'spo2' | 'temp';

/** Agreement limits shown on the report (heart rate ±5 bpm, SpO₂ ±3 points, temperature ±0.5 °C). */
export const REPORT_TOLERANCE: Record<Metric, number> = { hr: 5, spo2: 3, temp: 0.5 };

export interface AgreementPoint {
  volunteerId: string;
  sessionId: string;
  ring: number;
  reference: number;
  /** (ring + reference) / 2, the x axis of a Bland–Altman plot. */
  mean: number;
  /** ring − reference. */
  diff: number;
}

export interface MetricAccuracy {
  metric: Metric;
  /** Sessions with both a ring mean and a reference reading. */
  n: number;
  /** Mean difference (ring − reference). */
  bias: number;
  /** Sample standard deviation of the differences; null with fewer than 2 sessions. */
  sd: number | null;
  /** 95 % limits of agreement, bias ± 1.96 SD; null with fewer than 2 sessions. */
  loaLow: number | null;
  loaHigh: number | null;
  /** Mean absolute difference. */
  mae: number;
  /** Root-mean-square difference (for SpO₂ this is A_rms). */
  rmse: number;
  /** % of sessions whose difference is within the tolerance. */
  withinPct: number;
  tolerance: number;
  points: AgreementPoint[];
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Agreement points for one metric. Simulated and real-ring sessions must not be mixed: pass one source. */
export function agreementPoints(sessions: readonly ValidationSession[], metric: Metric): AgreementPoint[] {
  const points: AgreementPoint[] = [];
  for (const session of sessions) {
    const c = summarize(session)[metric];
    if (c.ring === null || c.reference === null) continue;
    points.push({
      volunteerId: session.volunteerId,
      sessionId: session.id,
      ring: c.ring,
      reference: c.reference,
      mean: round((c.ring + c.reference) / 2),
      diff: round(c.ring - c.reference),
    });
  }
  return points;
}

/** Bland–Altman statistics for one metric, or null when no session has both values. */
export function metricAccuracy(
  sessions: readonly ValidationSession[],
  metric: Metric,
  tolerance = REPORT_TOLERANCE[metric],
): MetricAccuracy | null {
  const points = agreementPoints(sessions, metric);
  const n = points.length;
  if (!n) return null;
  const diffs = points.map((p) => p.diff);
  const bias = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(diffs.reduce((a, d) => a + (d - bias) ** 2, 0) / (n - 1)) : null;
  return {
    metric,
    n,
    bias: round(bias),
    sd: sd === null ? null : round(sd),
    loaLow: sd === null ? null : round(bias - 1.96 * sd),
    loaHigh: sd === null ? null : round(bias + 1.96 * sd),
    mae: round(diffs.reduce((a, d) => a + Math.abs(d), 0) / n),
    rmse: round(Math.sqrt(diffs.reduce((a, d) => a + d * d, 0) / n)),
    withinPct: Math.round((100 * diffs.filter((d) => Math.abs(d) <= tolerance + 1e-9).length) / n),
    tolerance,
    points,
  };
}

/** Sessions of one source, oldest first, for the report. */
export function sessionsFor(sessions: readonly ValidationSession[], source: ValidationSession['source']): ValidationSession[] {
  return sessions.filter((s) => s.source === source).sort((a, b) => a.startedAt - b.startedAt);
}
