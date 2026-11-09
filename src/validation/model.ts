/**
 * Validation mode: timed sessions comparing the ring with reference devices (fingertip oximeter,
 * thermometer) for the Stage 3 accuracy table. Pure functions only; tested.
 */
import { FINGER_ON, MIN_CONFIDENCE } from '../ring/contract';
import type { LivePacket } from '../ring/packets';

/** One ring packet as recorded during a validation session. */
export interface ValidationSample extends LivePacket {
  /** Wall-clock ms when the phone received it. */
  receivedAt: number;
}

export interface Reference {
  hrBpm: number | null;
  spo2Pct: number | null;
  tempC: number | null;
}

export interface ValidationSession {
  id: string;
  volunteerId: string;
  startedAt: number;
  endedAt: number;
  plannedS: number;
  /** 'ring' for the real ring, 'sim' for the simulator (never mix them in the accuracy table). */
  source: 'ring' | 'sim';
  samples: ValidationSample[];
  reference: Reference;
}

export interface Comparison {
  /** Mean of the ring's trustworthy readings, or null if there were none. */
  ring: number | null;
  reference: number | null;
  /** ring − reference. */
  diff: number | null;
  /** How many ring samples went into the mean. */
  n: number;
}

export interface ValidationSummary {
  hr: Comparison;
  spo2: Comparison;
  temp: Comparison;
  samples: number;
  /** % of samples that passed the reading gate (finger on, confidence ≥ 80, still). */
  validPct: number;
}

export const DURATIONS_S = [60, 120, 180, 300] as const;
export const DEFAULT_DURATION_S = 120;

/** Same gate the live screens use. */
export function isTrustworthy(s: LivePacket): boolean {
  return s.fingerStatus === FINGER_ON && s.confidence >= MIN_CONFIDENCE && !s.motion;
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function compare(values: number[], reference: number | null, digits: number): Comparison {
  const m = mean(values);
  const ring = m === null ? null : round(m, digits);
  return {
    ring,
    reference,
    diff: ring !== null && reference !== null ? round(ring - reference, digits) : null,
    n: values.length,
  };
}

export function summarize(session: Pick<ValidationSession, 'samples' | 'reference'>): ValidationSummary {
  const ok = session.samples.filter(isTrustworthy);
  const hr = ok.map((s) => s.hrBpm).filter((v): v is number => v !== null);
  const spo2 = ok.map((s) => s.spo2Pct).filter((v): v is number => v !== null);
  // Temperature doesn't depend on the pulse-ox confidence, only on the ring being worn.
  const temp = session.samples
    .filter((s) => s.fingerStatus === FINGER_ON)
    .map((s) => s.skinTempC)
    .filter((v): v is number => v !== null);
  return {
    hr: compare(hr, session.reference.hrBpm, 1),
    spo2: compare(spo2, session.reference.spo2Pct, 1),
    temp: compare(temp, session.reference.tempC, 2),
    samples: session.samples.length,
    validPct: session.samples.length ? Math.round((100 * ok.length) / session.samples.length) : 0,
  };
}

/** Volunteer IDs are short codes, never names: letters, digits, dash, underscore. */
export function validVolunteerId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,20}$/.test(id.trim());
}

/** Plausible reference readings; anything else is almost certainly a typo. */
export function validReference(r: Reference): boolean {
  const ok = (v: number | null, lo: number, hi: number) => v === null || (Number.isFinite(v) && v >= lo && v <= hi);
  return ok(r.hrBpm, 25, 250) && ok(r.spo2Pct, 50, 100) && ok(r.tempC, 25, 43);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Every ring sample of one session, with timestamps, for offline analysis. */
export function samplesCsv(session: ValidationSession): string {
  const header = [
    'volunteer_id',
    'session_id',
    'source',
    'received_at_utc',
    'ring_timestamp_ms',
    'hr_bpm',
    'spo2_pct',
    'confidence',
    'finger_status',
    'skin_temp_c',
    'rr_interval_ms',
    'motion_flag',
    'battery_pct',
    'beat_seq',
    'trustworthy',
  ];
  const rows = session.samples.map((s) => [
    session.volunteerId,
    session.id,
    session.source,
    iso(s.receivedAt),
    s.timestampMs,
    s.hrBpm,
    s.spo2Pct,
    s.confidence,
    s.fingerStatus,
    s.skinTempC,
    s.rrMs,
    s.motion ? 1 : 0,
    s.batteryPct,
    s.beatSeq,
    isTrustworthy(s) ? 1 : 0,
  ]);
  return csv([header, ...rows]);
}

/** One row per session: the accuracy table. */
export function summaryCsv(sessions: readonly ValidationSession[]): string {
  const header = [
    'volunteer_id',
    'session_id',
    'source',
    'started_at_utc',
    'duration_s',
    'samples',
    'valid_pct',
    'hr_ring_mean',
    'hr_reference',
    'hr_diff',
    'hr_n',
    'spo2_ring_mean',
    'spo2_reference',
    'spo2_diff',
    'spo2_n',
    'temp_ring_mean_c',
    'temp_reference_c',
    'temp_diff_c',
    'temp_n',
  ];
  const rows = sessions.map((v) => {
    const s = summarize(v);
    return [
      v.volunteerId,
      v.id,
      v.source,
      iso(v.startedAt),
      Math.round((v.endedAt - v.startedAt) / 1000),
      s.samples,
      s.validPct,
      s.hr.ring,
      s.hr.reference,
      s.hr.diff,
      s.hr.n,
      s.spo2.ring,
      s.spo2.reference,
      s.spo2.diff,
      s.spo2.n,
      s.temp.ring,
      s.temp.reference,
      s.temp.diff,
      s.temp.n,
    ];
  });
  return csv([header, ...rows]);
}
