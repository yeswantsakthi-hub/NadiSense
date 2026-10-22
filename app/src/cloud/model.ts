/**
 * Cloud data model (Firestore). Pure helpers only; no Firebase imports, so everything here is unit tested.
 *
 * users/{uid}                     profile + consent
 * users/{uid}/sessions/{id}       one summary per ring session (numbers only)
 * users/{uid}/recordings/{id}     raw 30 s recordings, base64 little-endian samples
 * users/{uid}/shares/{token}      the owner's list of doctor links
 * shares/{token}                  read-only snapshot a doctor can open with the link
 */

export type Sex = 'female' | 'male' | 'other' | 'unsaid';

export interface CuffReading {
  sys: number;
  dia: number;
  /** Wall-clock ms. */
  at: number;
}

export interface Profile {
  age: number | null;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  cuff: CuffReading | null;
}

export interface Consent {
  summaries: boolean;
  raw: boolean;
  /** Wall-clock ms of the last decision; null until the person has chosen. */
  decidedAt: number | null;
}

export const EMPTY_PROFILE: Profile = { age: null, sex: 'unsaid', heightCm: null, weightKg: null, cuff: null };
export const NO_CONSENT: Consent = { summaries: false, raw: false, decidedAt: null };

export interface SessionSummary {
  id: string;
  /** Local calendar day, YYYY-MM-DD, for grouping. */
  day: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  source: 'mock' | 'ble';
  scenario: string | null;
  motionEvents: number;
  flaggedS: number;
  temp: { min: number; max: number; avg: number; n: number } | null;
  battery: { start: number; end: number } | null;
  /** Filled in once the signal-processing phases land. */
  vitals: { hr: number | null; spo2: number | null; hrv: number | null; resp: number | null };
}

export interface DayRow {
  day: string;
  sessions: number;
  minutes: number;
  /** Share of monitored time flagged for movement, 0–100. */
  motionPct: number;
  tempAvg: number | null;
}

export interface Recording {
  id: string;
  kind: 'ppg' | 'ecg' | 'imu';
  startedAt: number;
  rateHz: number;
  channels: string[];
  encoding: 'int32le' | 'int16le';
  /** Per channel: multiply stored integers by this to get the original unit. */
  scale: number;
  n: number;
  data: Record<string, string>;
}

export interface ShareSnapshot {
  name: string;
  age: number | null;
  sex: Sex;
  generatedAt: number;
  days: DayRow[];
}

/** Firestore documents must stay under 1 MiB; keep recordings comfortably below that. */
export const MAX_RECORDING_BYTES = 700_000;
export const SHARE_DAYS = 7;

export function localDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Integers → little-endian bytes → base64. Values are rounded and clamped to the type's range. */
export function encodeSamples(values: readonly number[], encoding: Recording['encoding']): string {
  const size = encoding === 'int32le' ? 4 : 2;
  const view = new DataView(new ArrayBuffer(values.length * size));
  values.forEach((v, i) => {
    const r = Math.round(v);
    if (size === 4) view.setInt32(i * 4, Math.max(-2147483648, Math.min(2147483647, r)), true);
    else view.setInt16(i * 2, Math.max(-32768, Math.min(32767, r)), true);
  });
  return toBase64(new Uint8Array(view.buffer));
}

export function decodeSamples(text: string, encoding: Recording['encoding']): number[] {
  const bytes = fromBase64(text);
  const view = new DataView(bytes.buffer);
  const size = encoding === 'int32le' ? 4 : 2;
  const out: number[] = [];
  for (let i = 0; i + size <= bytes.length; i += size) out.push(size === 4 ? view.getInt32(i, true) : view.getInt16(i, true));
  return out;
}

/** Total encoded size of a recording's channels, to check against MAX_RECORDING_BYTES. */
export function recordingBytes(r: Pick<Recording, 'data'>): number {
  return Object.values(r.data).reduce((sum, s) => sum + s.length, 0);
}

/** Group session summaries into one row per day, newest first. */
export function rollupByDay(sessions: readonly SessionSummary[]): DayRow[] {
  const byDay = new Map<string, { sessions: number; seconds: number; flagged: number; tempSum: number; tempN: number }>();
  for (const s of sessions) {
    const row = byDay.get(s.day) ?? { sessions: 0, seconds: 0, flagged: 0, tempSum: 0, tempN: 0 };
    row.sessions += 1;
    row.seconds += s.durationS;
    row.flagged += s.flaggedS;
    if (s.temp) {
      row.tempSum += s.temp.avg * s.temp.n;
      row.tempN += s.temp.n;
    }
    byDay.set(s.day, row);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, r]) => ({
      day,
      sessions: r.sessions,
      minutes: Math.round(r.seconds / 60),
      motionPct: r.seconds ? Math.round((100 * r.flagged) / r.seconds) : 0,
      tempAvg: r.tempN ? Math.round((r.tempSum / r.tempN) * 100) / 100 : null,
    }));
}

/** Plausible human ranges; anything outside is almost certainly a typo. */
export function validateProfile(p: Profile): boolean {
  const inRange = (v: number | null, lo: number, hi: number) => v === null || (Number.isFinite(v) && v >= lo && v <= hi);
  if (!inRange(p.age, 1, 120) || !inRange(p.heightCm, 50, 250) || !inRange(p.weightKg, 2, 300)) return false;
  if (p.cuff) {
    const { sys, dia } = p.cuff;
    if (!inRange(sys, 60, 260) || !inRange(dia, 30, 160) || dia >= sys) return false;
  }
  return true;
}

/** Unguessable 128-bit token for doctor links. */
export function newShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
