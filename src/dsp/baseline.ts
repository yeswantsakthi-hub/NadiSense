/**
 * Personal skin-temperature baseline: the mean of the person's first three sessions that had
 * enough temperature readings. Temperature is then shown as drift from that baseline,
 * because absolute finger-skin temperature varies a lot between people and rooms.
 */

export const BASELINE_SESSIONS = 3;
/** A session needs at least this many temperature samples (about a minute on the finger). */
export const MIN_TEMP_SAMPLES = 2;

export interface TempSession {
  startedAt: number;
  temp: { avg: number; n: number } | null;
}

export type Baseline = { status: 'building'; sessions: number } | { status: 'ready'; celsius: number };

export function temperatureBaseline(sessions: readonly TempSession[]): Baseline {
  const usable = sessions
    .filter((s) => s.temp && s.temp.n >= MIN_TEMP_SAMPLES)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(0, BASELINE_SESSIONS);
  if (usable.length < BASELINE_SESSIONS) return { status: 'building', sessions: usable.length };
  const celsius = usable.reduce((sum, s) => sum + s.temp!.avg, 0) / usable.length;
  return { status: 'ready', celsius: Math.round(celsius * 100) / 100 };
}

/** Current temperature minus baseline, rounded to 0.1 °C. */
export function temperatureDrift(currentC: number, baselineC: number): number {
  return Math.round((currentC - baselineC) * 10) / 10;
}
