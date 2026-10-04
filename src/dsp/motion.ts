/** Accelerometer sample in g (same shape as ImuSample, kept local so dsp/ has no app imports). */
export interface Accel {
  t: number;
  ax: number;
  ay: number;
  az: number;
}

/** Movement starts above this score (g) and ends below MOTION_OFF, so the flag doesn't flicker. */
export const MOTION_ON = 0.03;
export const MOTION_OFF = 0.015;

export function accelMagnitude(s: Accel): number {
  return Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
}

/** Standard deviation of acceleration magnitude (g). Near 0 when the hand is still. */
export function motionScore(window: readonly Accel[]): number {
  if (window.length < 2) return 0;
  let sum = 0;
  for (const s of window) sum += accelMagnitude(s);
  const mean = sum / window.length;
  let sq = 0;
  for (const s of window) sq += (accelMagnitude(s) - mean) ** 2;
  return Math.sqrt(sq / window.length);
}

/** Hysteresis step: is the hand moving, given the previous state and the latest score? */
export function nextMotionState(moving: boolean, score: number): boolean {
  return moving ? score >= MOTION_OFF : score > MOTION_ON;
}

/**
 * Time ranges (ms) where IMU shows movement, using sliding windows of `windowMs`.
 * PPG inside these ranges should be treated as corrupted.
 */
export function flagMotionSegments(imu: readonly Accel[], windowMs = 500): { from: number; to: number }[] {
  const segments: { from: number; to: number }[] = [];
  let moving = false;
  let start = 0;
  let lo = 0;
  for (let hi = 0; hi < imu.length; hi++) {
    const t = imu[hi]!.t;
    while (imu[lo]!.t <= t - windowMs) lo++;
    const next = nextMotionState(moving, motionScore(imu.slice(lo, hi + 1)));
    if (next && !moving) start = imu[lo]!.t;
    if (!next && moving) segments.push({ from: start, to: t });
    moving = next;
  }
  if (moving && imu.length) segments.push({ from: start, to: imu[imu.length - 1]!.t });
  return segments;
}
