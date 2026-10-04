import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROFILE,
  decodeSamples,
  encodeSamples,
  localDay,
  newShareToken,
  recordingBytes,
  rollupByDay,
  validateProfile,
  type SessionSummary,
} from './model';
import { SessionStats } from './SessionStats';

const session = (over: Partial<SessionSummary>): SessionSummary => ({
  id: 'x',
  day: '2026-10-04',
  startedAt: 0,
  endedAt: 0,
  durationS: 600,
  source: 'mock',
  scenario: 'normal',
  motionEvents: 0,
  flaggedS: 0,
  temp: null,
  battery: null,
  vitals: { hr: null, spo2: null, hrv: null, resp: null },
  ...over,
});

describe('sample encoding', () => {
  it('round-trips 32-bit PPG counts and 16-bit ECG values', () => {
    const ppg = [0, 1, 120000, 2147483647, -5];
    expect(decodeSamples(encodeSamples(ppg, 'int32le'), 'int32le')).toEqual(ppg);
    const ecg = [0, -1100, 1100, 32767, -32768];
    expect(decodeSamples(encodeSamples(ecg, 'int16le'), 'int16le')).toEqual(ecg);
  });

  it('rounds and clamps to the integer range', () => {
    expect(decodeSamples(encodeSamples([1.6, 40000, -40000], 'int16le'), 'int16le')).toEqual([2, 32767, -32768]);
  });

  it('keeps a 30 s two-channel PPG recording well under the Firestore limit', () => {
    const channel = encodeSamples(Array.from({ length: 30 * 400 }, (_, i) => 120000 + i), 'int32le');
    expect(recordingBytes({ data: { red: channel, ir: channel } })).toBeLessThan(700_000);
  });
});

describe('rollupByDay', () => {
  it('sums sessions per day, newest day first', () => {
    const rows = rollupByDay([
      session({ day: '2026-10-03', durationS: 1200, flaggedS: 60, temp: { min: 36, max: 37, avg: 36.5, n: 2 } }),
      session({ day: '2026-10-04', durationS: 600, flaggedS: 0 }),
      session({ day: '2026-10-03', durationS: 600, flaggedS: 30, temp: { min: 36, max: 37, avg: 36.8, n: 1 } }),
    ]);
    expect(rows.map((r) => r.day)).toEqual(['2026-10-04', '2026-10-03']);
    expect(rows[1]).toEqual({ day: '2026-10-03', sessions: 2, minutes: 30, motionPct: 5, tempAvg: 36.6 });
    expect(rows[0]!.tempAvg).toBeNull();
  });

  it('is empty without sessions', () => {
    expect(rollupByDay([])).toEqual([]);
  });
});

describe('validateProfile', () => {
  it('accepts an empty or plausible profile', () => {
    expect(validateProfile(EMPTY_PROFILE)).toBe(true);
    expect(
      validateProfile({ age: 52, sex: 'female', heightCm: 158, weightKg: 61, cuff: { sys: 128, dia: 82, at: 0 } }),
    ).toBe(true);
  });

  it('rejects typos and impossible blood pressure', () => {
    expect(validateProfile({ ...EMPTY_PROFILE, age: 520 })).toBe(false);
    expect(validateProfile({ ...EMPTY_PROFILE, heightCm: 16 })).toBe(false);
    expect(validateProfile({ ...EMPTY_PROFILE, cuff: { sys: 80, dia: 120, at: 0 } })).toBe(false);
  });
});

describe('localDay and tokens', () => {
  it('formats a local calendar day', () => {
    expect(localDay(new Date(2026, 9, 4, 23, 59).getTime())).toBe('2026-10-04');
  });

  it('makes long, unique share tokens', () => {
    const a = newShareToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newShareToken()).not.toBe(a);
  });
});

describe('SessionStats', () => {
  it('summarises duration, movement, temperature and battery', () => {
    const start = new Date(2026, 9, 4, 9, 0).getTime();
    const s = new SessionStats('mock', 'normal', start, 'abcd');
    s.battery(86);
    s.temperature(36.5);
    s.temperature(36.7);
    s.motionStart(start + 60_000);
    s.motionEnd(start + 64_000);
    s.motionStart(start + 120_000);
    s.battery(84);
    const sum = s.summary(start + 122_000);
    expect(sum).toMatchObject({
      id: `${start}-abcd`,
      day: '2026-10-04',
      durationS: 122,
      motionEvents: 2,
      flaggedS: 6,
      temp: { min: 36.5, max: 36.7, avg: 36.6, n: 2 },
      battery: { start: 86, end: 84 },
    });
  });

  it('ignores a second start while already moving', () => {
    const s = new SessionStats('ble', null, 0, 'x');
    s.motionStart(1000);
    s.motionStart(2000);
    s.motionEnd(3000);
    expect(s.summary(3000)).toMatchObject({ motionEvents: 1, flaggedS: 2, temp: null, battery: null });
  });
});
