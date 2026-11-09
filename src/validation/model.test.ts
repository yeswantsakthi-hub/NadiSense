import { describe, expect, it } from 'vitest';
import {
  samplesCsv,
  summarize,
  summaryCsv,
  validReference,
  validVolunteerId,
  type ValidationSample,
  type ValidationSession,
} from './model';

const sample = (over: Partial<ValidationSample> = {}): ValidationSample => ({
  receivedAt: Date.UTC(2026, 10, 9, 10, 0, 0),
  timestampMs: 1000,
  hrBpm: 70,
  spo2Pct: 97,
  confidence: 95,
  fingerStatus: 3,
  skinTempC: 34,
  rrMs: 857,
  motion: false,
  batteryPct: 80,
  beatSeq: 1,
  ...over,
});

const session = (samples: ValidationSample[], over: Partial<ValidationSession> = {}): ValidationSession => ({
  id: 's1',
  volunteerId: 'V01',
  startedAt: Date.UTC(2026, 10, 9, 10, 0, 0),
  endedAt: Date.UTC(2026, 10, 9, 10, 2, 0),
  plannedS: 120,
  source: 'ring',
  samples,
  reference: { hrBpm: 72, spo2Pct: 98, tempC: 36.6 },
  ...over,
});

describe('summarize', () => {
  it('compares the mean of trustworthy ring readings with the reference', () => {
    const s = summarize(
      session([
        sample({ hrBpm: 70, spo2Pct: 96, skinTempC: 34.0 }),
        sample({ hrBpm: 74, spo2Pct: 98, skinTempC: 34.2 }),
        sample({ hrBpm: 120, spo2Pct: 80, confidence: 40, skinTempC: 34.4 }), // low confidence: no HR/SpO2
        sample({ hrBpm: 130, motion: true, skinTempC: 34.6 }), // moving: no HR/SpO2, temp still counts
        sample({ fingerStatus: 1, hrBpm: null, spo2Pct: null, skinTempC: 30 }), // off the finger: nothing
      ]),
    );
    expect(s.hr).toEqual({ ring: 72, reference: 72, diff: 0, n: 2 });
    expect(s.spo2).toEqual({ ring: 97, reference: 98, diff: -1, n: 2 });
    expect(s.temp).toEqual({ ring: 34.3, reference: 36.6, diff: -2.3, n: 4 });
    expect(s.samples).toBe(5);
    expect(s.validPct).toBe(40);
  });

  it('leaves comparisons empty when there is no data or no reference', () => {
    const s = summarize(session([sample({ fingerStatus: 0 })], { reference: { hrBpm: null, spo2Pct: 95, tempC: null } }));
    expect(s.hr).toEqual({ ring: null, reference: null, diff: null, n: 0 });
    expect(s.spo2).toEqual({ ring: null, reference: 95, diff: null, n: 0 });
    expect(summarize(session([])).validPct).toBe(0);
  });
});

describe('input checks', () => {
  it('accepts short volunteer codes only', () => {
    expect(validVolunteerId('V01')).toBe(true);
    expect(validVolunteerId('team-A_7')).toBe(true);
    expect(validVolunteerId('')).toBe(false);
    expect(validVolunteerId('Asha Kumar')).toBe(false);
    expect(validVolunteerId('x'.repeat(21))).toBe(false);
  });

  it('accepts plausible references, or blanks', () => {
    expect(validReference({ hrBpm: 72, spo2Pct: 98, tempC: 36.6 })).toBe(true);
    expect(validReference({ hrBpm: null, spo2Pct: null, tempC: null })).toBe(true);
    expect(validReference({ hrBpm: 720, spo2Pct: 98, tempC: 36.6 })).toBe(false);
    expect(validReference({ hrBpm: 72, spo2Pct: 101, tempC: 36.6 })).toBe(false);
    expect(validReference({ hrBpm: 72, spo2Pct: 98, tempC: 366 })).toBe(false);
  });
});

describe('CSV export', () => {
  it('writes one row per ring sample with timestamps and the gate result', () => {
    const text = samplesCsv(session([sample(), sample({ motion: true, rrMs: null, skinTempC: null })]));
    const lines = text.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.split(',')).toContain('ring_timestamp_ms');
    expect(lines[1]).toBe('V01,s1,ring,2026-11-09T10:00:00.000Z,1000,70,97,95,3,34,857,0,80,1,1');
    expect(lines[2]).toBe('V01,s1,ring,2026-11-09T10:00:00.000Z,1000,70,97,95,3,,,1,80,1,0');
  });

  it('writes the accuracy table, one row per session, and escapes awkward text', () => {
    const text = summaryCsv([session([sample(), sample({ hrBpm: 74 })], { volunteerId: 'V,02' })]);
    const [header, row] = text.trimEnd().split('\r\n');
    expect(header!.startsWith('volunteer_id,session_id,source,started_at_utc,duration_s')).toBe(true);
    expect(row).toBe('"V,02",s1,ring,2026-11-09T10:00:00.000Z,120,2,100,72,72,0,2,97,98,-1,2,34,36.6,-2.6,2');
  });
});
