/**
 * Irregular-rhythm screening from beat-to-beat (RR) intervals. Pure functions, no side effects.
 *
 * Uses only successive differences between beats that really are consecutive (beat_seq + 1),
 * skips beats flagged for movement and implausible intervals, and needs a full 2-minute window.
 * Result is a screening flag, never a diagnosis.
 */

export interface RrBeat {
  /** Wall-clock ms when the beat arrived. */
  at: number;
  rrMs: number;
  beatSeq: number;
  motion: boolean;
}

export const RHYTHM_WINDOW_MS = 120_000;
/** Below this many clean successive differences the result would be noise. */
export const MIN_DIFFS = 60;
/** No beat for this long (finger off, link lost): the old result no longer describes now. */
export const STALE_MS = 5000;
const RR_MIN_MS = 300; // 200 bpm
const RR_MAX_MS = 2000; // 30 bpm

/**
 * Flag thresholds. Both must be exceeded: high beat-to-beat change (pNN50) alone is common in
 * healthy young people at rest, so it is combined with RMSSD relative to the mean interval.
 */
export const PNN50_FLAG = 40;
export const NRMSSD_FLAG = 0.12;

export type RhythmResult =
  | { status: 'collecting'; progress: number; cleanBeats: number }
  | {
      status: 'regular' | 'irregular';
      rmssdMs: number;
      /** % of successive differences > 50 ms. */
      pnn50: number;
      meanRrMs: number;
      meanHr: number;
      cleanBeats: number;
      diffs: number;
    };

/** RMSSD of successive differences, in ms. */
export function rmssd(diffs: readonly number[]): number {
  if (!diffs.length) return 0;
  return Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length);
}

/** % of successive differences larger than 50 ms. */
export function pnn50(diffs: readonly number[]): number {
  if (!diffs.length) return 0;
  return (100 * diffs.filter((d) => Math.abs(d) > 50).length) / diffs.length;
}

/** Successive differences between consecutive, still, plausible beats. */
export function cleanDiffs(beats: readonly RrBeat[]): { diffs: number[]; clean: RrBeat[] } {
  const ok = (b: RrBeat) => !b.motion && b.rrMs >= RR_MIN_MS && b.rrMs <= RR_MAX_MS;
  const clean = beats.filter(ok);
  const diffs: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1]!;
    const b = beats[i]!;
    const consecutive = ((b.beatSeq - a.beatSeq + 0x10000) & 0xffff) === 1;
    if (consecutive && ok(a) && ok(b)) diffs.push(b.rrMs - a.rrMs);
  }
  return { diffs, clean };
}

/** Rhythm over the last 2 minutes of beats (oldest first) ending at `now`. */
export function analyseRhythm(beats: readonly RrBeat[], now: number): RhythmResult {
  const windowBeats = beats.filter((b) => b.at > now - RHYTHM_WINDOW_MS && b.at <= now);
  const lastBeat = windowBeats[windowBeats.length - 1];
  if (!lastBeat || now - lastBeat.at > STALE_MS) {
    return { status: 'collecting', progress: 0, cleanBeats: 0 };
  }
  const { diffs, clean } = cleanDiffs(windowBeats);
  const span = windowBeats.length ? now - windowBeats[0]!.at : 0;
  const progress = Math.min(1, Math.min(span / RHYTHM_WINDOW_MS, diffs.length / MIN_DIFFS));
  if (span < RHYTHM_WINDOW_MS * 0.95 || diffs.length < MIN_DIFFS) {
    return { status: 'collecting', progress, cleanBeats: clean.length };
  }
  const meanRrMs = clean.reduce((s, b) => s + b.rrMs, 0) / clean.length;
  const r = rmssd(diffs);
  const p = pnn50(diffs);
  return {
    status: p >= PNN50_FLAG && r / meanRrMs >= NRMSSD_FLAG ? 'irregular' : 'regular',
    rmssdMs: Math.round(r),
    pnn50: Math.round(p),
    meanRrMs: Math.round(meanRrMs),
    meanHr: Math.round(60000 / meanRrMs),
    cleanBeats: clean.length,
    diffs: diffs.length,
  };
}
