import { createRng, gaussian } from './random';
import {
  ECG_RATE_HZ,
  IMU_RATE_HZ,
  PPG_RATE_HZ,
  type EcgSample,
  type ImuSample,
  type PpgSample,
} from './SensorSource';

export type Scenario = 'normal' | 'irregular' | 'apnea-night';
export const SCENARIOS: readonly Scenario[] = ['normal', 'irregular', 'apnea-night'];

/** Ground-truth beat. `r` is the ECG R-peak; the PPG foot follows at `r + pat`. All in ms. */
export interface Beat {
  r: number;
  /** Interval from this beat's R-peak to the next one. */
  rr: number;
  /** Pulse arrival time, R-peak to PPG foot. */
  pat: number;
  amp: number;
}

interface MotionEvent {
  start: number;
  end: number;
  f1: number;
  f2: number;
  p1: number;
  p2: number;
  p3: number;
}

const PPG_DT = 1000 / PPG_RATE_HZ;
const ECG_DT = 1000 / ECG_RATE_HZ;
const IMU_DT = 1000 / IMU_RATE_HZ;
export const RESP_RATE_PER_MIN = 14;
const RESP_PERIOD_MS = 60000 / RESP_RATE_PER_MIN;
const TWO_PI = 2 * Math.PI;
/** Beats and motion events older than this behind the PPG cursor are dropped. */
const HISTORY_MS = 60000;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const resp = (t: number) => Math.sin((TWO_PI * t) / RESP_PERIOD_MS);

/**
 * One PPG pulse (arbitrary units, systolic peak ≈ 1) `tau` seconds after the foot:
 * a sharp-rising systolic Gaussian plus a later reflected wave, which leaves a dicrotic notch between them.
 */
export function ppgPulse(tau: number, rrMs: number): number {
  if (tau < 0 || tau > 1.4) return 0;
  const s = Math.sqrt(clamp(rrMs / 857, 0.6, 1.4));
  const mu1 = 0.14 * s;
  const sig1 = (tau < mu1 ? 0.045 : 0.065) * s;
  const mu2 = 0.38 * s;
  const sig2 = 0.07 * s;
  const systolic = Math.exp(-((tau - mu1) ** 2) / (2 * sig1 * sig1));
  const reflected = 0.45 * Math.exp(-((tau - mu2) ** 2) / (2 * sig2 * sig2));
  return systolic + reflected;
}

/** P-QRS-T waves as Gaussians relative to the R-peak: offset (s), amplitude (mV), width (s). */
const ECG_WAVES = [
  { name: 'P', mu: -0.2, a: 0.12, sig: 0.025 },
  { name: 'Q', mu: -0.035, a: -0.1, sig: 0.009 },
  { name: 'R', mu: 0, a: 1.1, sig: 0.011 },
  { name: 'S', mu: 0.035, a: -0.22, sig: 0.01 },
  { name: 'T', mu: 0.3, a: 0.28, sig: 0.055 },
] as const;

/**
 * Deterministic synthetic physiology. No timers: callers ask for samples up to a time.
 * Each stream has its own RNG so output does not depend on how calls are chunked.
 */
export class MockSignalModel {
  scenario: Scenario;
  private beats: Beat[] = [];
  private motions: MotionEvent[] = [];
  private readonly beatRng: () => number;
  private readonly motionRng: () => number;
  private readonly ppgRng: () => number;
  private readonly ecgRng: () => number;
  private readonly imuRng: () => number;
  private ppgIndex = 0;
  private imuIndex = 0;
  private ecgIndex = 0;
  private ecgWindow: { start: number; end: number } | null = null;

  constructor(opts: { seed?: number; scenario?: Scenario } = {}) {
    const seed = opts.seed ?? 1;
    this.scenario = opts.scenario ?? 'normal';
    this.beatRng = createRng(seed);
    this.motionRng = createRng(seed + 101);
    this.ppgRng = createRng(seed + 202);
    this.ecgRng = createRng(seed + 303);
    this.imuRng = createRng(seed + 404);
  }

  /** Time of the next PPG sample not yet generated. */
  get ppgCursor(): number {
    return this.ppgIndex * PPG_DT;
  }

  get ecgActive(): boolean {
    return this.ecgWindow !== null;
  }

  /** Jump all streams forward (e.g. after the browser throttled a background tab). */
  skipTo(t: number): void {
    this.ppgIndex = Math.max(this.ppgIndex, Math.ceil(t / PPG_DT));
    this.imuIndex = Math.max(this.imuIndex, Math.ceil(t / IMU_DT));
    if (this.ecgWindow) this.ecgIndex = Math.max(this.ecgIndex, Math.ceil(t / ECG_DT));
    this.prune();
  }

  /** Underlying SpO2 (%) the PPG red/IR ratio is built from. */
  spo2(t: number): number {
    if (this.scenario !== 'apnea-night') return 97.6 + 0.4 * Math.sin((TWO_PI * t) / 420000);
    // Apnea events every 80 s after the first 20 s: slow desaturation to ~86 %, then quick recovery.
    if (t < 20000) return 97;
    const p = (t - 20000) % 80000;
    if (p < 30000) return 97 - 11 * (p / 30000) ** 1.5;
    if (p < 38000) return 86 + 11 * ((p - 30000) / 8000);
    return 97;
  }

  temperature(t: number): number {
    const c = 36.6 + 0.12 * Math.sin((TWO_PI * t) / 7200000) + 0.05 * Math.sin((TWO_PI * t) / 900000 + 1);
    return Math.round(c * 100) / 100;
  }

  /** Ground-truth beats with R-peak in [from, to). */
  beatsBetween(from: number, to: number): Beat[] {
    this.ensureBeats(to);
    return this.beats.filter((b) => b.r >= from && b.r < to).map((b) => ({ ...b }));
  }

  /** Motion intensity 0–1 at time t (0 when still). */
  motionLevel(t: number): number {
    return this.motionAt(t).e;
  }

  generatePpg(untilMs: number): PpgSample[] {
    const out: PpgSample[] = [];
    for (;;) {
      const t = this.ppgIndex * PPG_DT;
      if (t >= untilMs) break;
      out.push(this.ppgAt(t));
      this.ppgIndex++;
    }
    this.prune();
    return out;
  }

  generateImu(untilMs: number): ImuSample[] {
    const out: ImuSample[] = [];
    for (;;) {
      const t = this.imuIndex * IMU_DT;
      if (t >= untilMs) break;
      out.push(this.imuAt(t));
      this.imuIndex++;
    }
    return out;
  }

  startEcg(startMs: number, durationMs: number): void {
    this.ecgWindow = { start: startMs, end: startMs + durationMs };
    this.ecgIndex = Math.ceil(startMs / ECG_DT);
  }

  /** ECG samples up to `untilMs`, only inside the window opened by `startEcg`. */
  generateEcg(untilMs: number): EcgSample[] {
    const win = this.ecgWindow;
    if (!win) return [];
    const end = Math.min(untilMs, win.end);
    const out: EcgSample[] = [];
    for (;;) {
      const t = this.ecgIndex * ECG_DT;
      if (t >= end) break;
      out.push(this.ecgAt(t));
      this.ecgIndex++;
    }
    if (untilMs >= win.end) this.ecgWindow = null;
    return out;
  }

  private baseHr(t: number): number {
    const hr =
      70 + 6 * Math.sin((TWO_PI * t) / 240000 + 0.7) + 2 * Math.sin((TWO_PI * t) / 97000) + 2.5 * resp(t);
    return clamp(hr, 61, 79);
  }

  private ensureBeats(untilMs: number): void {
    for (;;) {
      const last = this.beats[this.beats.length - 1];
      if (last && last.r > untilMs + 2000) return;
      this.addBeat(last);
    }
  }

  private addBeat(prev: Beat | undefined): void {
    const rng = this.beatRng;
    const r = prev ? prev.r + prev.rr : 250;
    let rr = 60000 / this.baseHr(r);
    if (this.scenario === 'irregular') {
      rr = clamp(rr * (0.6 + 0.8 * rng()), 400, 1600);
    } else {
      rr = clamp(rr + gaussian(rng) * 15, 750, 1000);
    }
    const pat = clamp(225 + 15 * Math.sin((TWO_PI * r) / 180000) + gaussian(rng) * 4, 200, 250);
    // After a short filling interval the next pulse is weaker (matters for irregular rhythm).
    const fill = prev ? prev.rr : rr;
    const fillFactor = this.scenario === 'irregular' ? clamp(0.55 + (0.45 * fill) / 850, 0.6, 1.25) : 1;
    const amp = fillFactor * (1 + 0.08 * resp(r)) * (1 + 0.03 * gaussian(rng));
    this.beats.push({ r, rr, pat, amp });
  }

  private ensureMotions(untilMs: number): void {
    const rng = this.motionRng;
    for (;;) {
      const last = this.motions[this.motions.length - 1];
      if (last && last.start > untilMs) return;
      const start = last ? last.end + 30000 + 60000 * rng() : 20000 + 20000 * rng();
      this.motions.push({
        start,
        end: start + 2000 + 3000 * rng(),
        f1: 1.2 + rng(),
        f2: 2.5 + rng(),
        p1: TWO_PI * rng(),
        p2: TWO_PI * rng(),
        p3: TWO_PI * rng(),
      });
    }
  }

  private motionAt(t: number): { e: number; ev: MotionEvent | null } {
    this.ensureMotions(t);
    for (const ev of this.motions) {
      if (t >= ev.start && t < ev.end) {
        const e = Math.sin((Math.PI * (t - ev.start)) / (ev.end - ev.start)) ** 2;
        return { e, ev };
      }
    }
    return { e: 0, ev: null };
  }

  private ppgAt(t: number): PpgSample {
    this.ensureBeats(t);
    let pulse = 0;
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i]!;
      const foot = b.r + b.pat;
      if (foot > t) continue;
      const tau = (t - foot) / 1000;
      if (tau > 1.4) break;
      pulse += b.amp * ppgPulse(tau, b.rr);
    }

    const rs = resp(t);
    const ratio = (110 - this.spo2(t)) / 25; // inverse of SpO2 ≈ 110 − 25·R
    const irDc = 120000 * (1 + 0.004 * rs);
    const redDc = 88000 * (1 + 0.004 * rs);
    const acFrac = 0.012 * (1 + 0.1 * rs);

    const { e, ev } = this.motionAt(t);
    let artifact = 0;
    if (ev) {
      const ts = t / 1000;
      artifact = e * (Math.sin(TWO_PI * ev.f1 * ts + ev.p1) + 0.6 * Math.sin(TWO_PI * ev.f2 * ts + ev.p2));
    }

    // More blood absorbs more light, so the pulse appears as a dip in detected light.
    const ir = irDc * (1 - acFrac * pulse) + artifact * irDc * acFrac * 3 + gaussian(this.ppgRng) * 12;
    const red =
      redDc * (1 - ratio * acFrac * pulse) + artifact * redDc * acFrac * 2.7 + gaussian(this.ppgRng) * 12;
    return { t, red: Math.round(red), ir: Math.round(ir) };
  }

  private ecgAt(t: number): EcgSample {
    this.ensureBeats(t + 1000);
    const irregular = this.scenario === 'irregular';
    let v = 0;
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i]!;
      const dt = (t - b.r) / 1000;
      if (dt < -0.7) continue;
      if (dt > 0.9) break;
      const qt = Math.sqrt(b.rr / 1000);
      for (const w of ECG_WAVES) {
        if (irregular && w.name === 'P') continue; // no organised atrial activity
        const mu = w.name === 'T' ? w.mu * qt : w.mu;
        v += w.a * Math.exp(-((dt - mu) ** 2) / (2 * w.sig * w.sig));
      }
    }
    const ts = t / 1000;
    if (irregular) v += 0.04 * Math.sin(TWO_PI * 5.5 * ts) + 0.02 * Math.sin(TWO_PI * 7.3 * ts + 1);
    v += 0.04 * resp(t) + gaussian(this.ecgRng) * 0.012;
    return { t, v: Math.round(v * 1000) / 1000 };
  }

  private imuAt(t: number): ImuSample {
    const { e, ev } = this.motionAt(t);
    const ts = t / 1000;
    const g = () => gaussian(this.imuRng) * 0.004;
    let mx = 0;
    let my = 0;
    let mz = 0;
    if (ev) {
      mx = 0.35 * e * Math.sin(TWO_PI * ev.f1 * ts + ev.p1);
      my = 0.25 * e * Math.sin(TWO_PI * ev.f2 * ts + ev.p2);
      mz = 0.2 * e * Math.sin(TWO_PI * ev.f1 * ts + ev.p3);
    }
    return { t, ax: 0.03 + mx + g(), ay: -0.06 + my + g(), az: 0.995 + mz + g() };
  }

  private prune(): void {
    const keepFrom = this.ppgCursor - HISTORY_MS;
    while (this.beats.length > 1 && this.beats[0]!.r < keepFrom) this.beats.shift();
    while (this.motions.length > 1 && this.motions[0]!.end < keepFrom) this.motions.shift();
  }
}
