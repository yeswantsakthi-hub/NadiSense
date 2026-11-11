/**
 * Ring diagnostics for firmware bring-up: how well the live link follows the BLE contract
 * (FIRMWARE.md). Pure functions over the recent packet log; tested.
 */
import { FINGER_ON, MIN_CONFIDENCE } from './contract';
import type { LivePacket } from './packets';

export interface LoggedPacket {
  /** Phone wall-clock ms when it arrived. */
  at: number;
  p: LivePacket;
}

/** Contract: at least one packet a second (keep-alive). Allow some BLE jitter before warning. */
export const MAX_GAP_MS = 1200;
export const DIAG_WINDOW_MS = 60_000;

export type CheckId = 'parse' | 'keepalive' | 'beats' | 'timestamps' | 'keepaliveSeq' | 'ranges';

export interface Check {
  id: CheckId;
  ok: boolean;
  /** Count of violations in the window. */
  count: number;
}

export interface Diagnostics {
  packets: number;
  windowS: number;
  packetsPerS: number;
  beatsPerMin: number;
  /** Longest silence between packets. */
  maxGapMs: number;
  /** Beats lost on the way (gaps in beat_seq between beat packets while the finger stayed on). */
  missedBeats: number;
  fingerOnPct: number;
  /** Confidence while the finger is on. */
  confidenceAvg: number | null;
  confidenceOkPct: number | null;
  motionPct: number;
  battery: number | null;
  /** Battery use in %/hour, once at least 5 minutes of history exist. */
  drainPctPerHour: number | null;
  /** Ring clock minus phone clock change over the window (ms); BLE delay jitter is included. */
  clockDriftMs: number | null;
  checks: Check[];
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/**
 * @param log packets oldest first
 * @param badPackets packets the parser rejected (whole connection)
 * @param battery optional longer battery history (oldest first) for the drain rate
 */
export function diagnose(
  log: readonly LoggedPacket[],
  now: number,
  badPackets = 0,
  windowMs = DIAG_WINDOW_MS,
  battery: readonly LoggedPacket[] = log,
): Diagnostics | null {
  const w = log.filter((r) => r.at > now - windowMs && r.at <= now);
  if (!w.length) return null;
  const span = Math.max(1, Math.min(windowMs, now - w[0]!.at));

  let maxGap = now - w[w.length - 1]!.at;
  let missed = 0;
  let tsBackwards = 0;
  let seqViolations = 0;
  let rangeViolations = 0;
  let lastBeat: LoggedPacket | null = null;
  /** The finger came off since the last beat: a jump in beat_seq is then expected. */
  let fingerLeft = false;
  for (let i = 0; i < w.length; i++) {
    const cur = w[i]!;
    const prev = w[i - 1];
    if (prev) {
      maxGap = Math.max(maxGap, cur.at - prev.at);
      if (cur.p.timestampMs < prev.p.timestampMs) tsBackwards++;
    }
    const on = cur.p.fingerStatus === FINGER_ON;
    if (!on) fingerLeft = true;
    if (on && (cur.p.hrBpm !== null && (cur.p.hrBpm < 25 || cur.p.hrBpm > 250))) rangeViolations++;
    if (cur.p.rrMs !== null) {
      if (cur.p.rrMs < 200 || cur.p.rrMs > 3000) rangeViolations++;
      if (lastBeat && on && !fingerLeft) {
        const step = (cur.p.beatSeq - lastBeat.p.beatSeq + 0x10000) & 0xffff;
        if (step > 1 && step < 1000) missed += step - 1;
      }
      lastBeat = cur;
      fingerLeft = false;
    } else if (lastBeat && cur.p.beatSeq !== lastBeat.p.beatSeq) {
      // Keep-alives must repeat the last beat number, or the app would miscount beats.
      seqViolations++;
    }
  }

  const beats = w.filter((r) => r.p.rrMs !== null).length;
  const on = w.filter((r) => r.p.fingerStatus === FINGER_ON);
  const conf = on.map((r) => r.p.confidence);

  const first = w[0]!;
  const last = w[w.length - 1]!;
  const clockDriftMs = w.length > 1 && last.at - first.at >= 5000 ? last.p.timestampMs - first.p.timestampMs - (last.at - first.at) : null;

  return {
    packets: w.length,
    windowS: Math.round(span / 1000),
    packetsPerS: Math.round((10 * w.length * 1000) / span) / 10,
    beatsPerMin: Math.round((beats * 60_000) / span),
    maxGapMs: Math.round(maxGap),
    missedBeats: missed,
    fingerOnPct: pct(on.length, w.length),
    confidenceAvg: conf.length ? Math.round(conf.reduce((a, b) => a + b, 0) / conf.length) : null,
    confidenceOkPct: conf.length ? pct(conf.filter((c) => c >= MIN_CONFIDENCE).length, conf.length) : null,
    motionPct: pct(w.filter((r) => r.p.motion).length, w.length),
    battery: last.p.batteryPct,
    drainPctPerHour: drainRate(battery),
    clockDriftMs,
    checks: [
      { id: 'parse', ok: badPackets === 0, count: badPackets },
      { id: 'keepalive', ok: maxGap <= MAX_GAP_MS, count: countGaps(w, now) },
      { id: 'beats', ok: missed === 0, count: missed },
      { id: 'timestamps', ok: tsBackwards === 0, count: tsBackwards },
      { id: 'keepaliveSeq', ok: seqViolations === 0, count: seqViolations },
      { id: 'ranges', ok: rangeViolations === 0, count: rangeViolations },
    ],
  };
}

function countGaps(w: readonly LoggedPacket[], now: number): number {
  let n = now - w[w.length - 1]!.at > MAX_GAP_MS ? 1 : 0;
  for (let i = 1; i < w.length; i++) if (w[i]!.at - w[i - 1]!.at > MAX_GAP_MS) n++;
  return n;
}

/** Least-squares slope of battery % over time, in %/hour (positive = draining). */
export function drainRate(log: readonly LoggedPacket[], minSpanMs = 5 * 60_000): number | null {
  if (log.length < 2 || log[log.length - 1]!.at - log[0]!.at < minSpanMs) return null;
  const t0 = log[0]!.at;
  const xs = log.map((r) => (r.at - t0) / 3_600_000);
  const ys = log.map((r) => r.p.batteryPct);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den ? Math.round(-(num / den) * 10) / 10 : null;
}

/** "0A 1B …" for showing raw bytes. */
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
