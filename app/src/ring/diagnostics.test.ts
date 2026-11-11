import { describe, expect, it } from 'vitest';
import { diagnose, drainRate, hex, type LoggedPacket } from './diagnostics';
import type { LivePacket } from './packets';

const pkt = (over: Partial<LivePacket> = {}): LivePacket => ({
  timestampMs: 0,
  hrBpm: 70,
  spo2Pct: 97,
  confidence: 95,
  fingerStatus: 3,
  skinTempC: 34,
  rrMs: 850,
  motion: false,
  batteryPct: 80,
  beatSeq: 0,
  ...over,
});

/** A clean ring: a beat every 850 ms, ring clock in step with the phone. */
function cleanLog(seconds: number, start = 0): LoggedPacket[] {
  const out: LoggedPacket[] = [];
  for (let i = 0, t = start; t < start + seconds * 1000; i++, t += 850) {
    out.push({ at: t, p: pkt({ timestampMs: t + 5000, beatSeq: i & 0xffff }) });
  }
  return out;
}

describe('diagnose', () => {
  it('returns null without packets in the window', () => {
    expect(diagnose([], 1000)).toBeNull();
  });

  it('passes every check for a clean link', () => {
    const log = cleanLog(60);
    const now = log[log.length - 1]!.at + 100;
    const d = diagnose(log, now)!;
    expect(d.beatsPerMin).toBeGreaterThan(65);
    expect(d.beatsPerMin).toBeLessThan(75);
    expect(d.maxGapMs).toBe(850);
    expect(d.missedBeats).toBe(0);
    expect(d.fingerOnPct).toBe(100);
    expect(d.confidenceOkPct).toBe(100);
    expect(d.clockDriftMs).toBe(0);
    expect(d.checks.every((c) => c.ok)).toBe(true);
  });

  it('counts missed beats, long gaps, bad packets and timestamps going backwards', () => {
    const log = cleanLog(20);
    log.splice(5, 3); // three beats lost, and a 3.4 s silence
    log[10] = { ...log[10]!, p: { ...log[10]!.p, timestampMs: 0 } };
    const now = log[log.length - 1]!.at + 100;
    const d = diagnose(log, now, 2)!;
    const check = (id: string) => d.checks.find((c) => c.id === id)!;
    expect(d.missedBeats).toBe(3);
    expect(check('beats')).toMatchObject({ ok: false, count: 3 });
    expect(check('keepalive').ok).toBe(false);
    expect(d.maxGapMs).toBe(3400);
    expect(check('parse')).toMatchObject({ ok: false, count: 2 });
    expect(check('timestamps').count).toBeGreaterThanOrEqual(1);
  });

  it('flags keep-alives that change the beat number', () => {
    const log: LoggedPacket[] = [
      { at: 0, p: pkt({ beatSeq: 1 }) },
      { at: 900, p: pkt({ rrMs: null, beatSeq: 1 }) },
      { at: 1800, p: pkt({ rrMs: null, beatSeq: 2 }) },
    ];
    const d = diagnose(log, 2000)!;
    expect(d.checks.find((c) => c.id === 'keepaliveSeq')).toMatchObject({ ok: false, count: 1 });
  });

  it('does not count beats as missed across finger-off', () => {
    const log: LoggedPacket[] = [
      { at: 0, p: pkt({ beatSeq: 1 }) },
      { at: 900, p: pkt({ rrMs: null, fingerStatus: 1, beatSeq: 1 }) },
      { at: 1800, p: pkt({ beatSeq: 9 }) },
    ];
    expect(diagnose(log, 2000)!.missedBeats).toBe(0);
  });

  it('reports out-of-range values and motion share', () => {
    const log: LoggedPacket[] = [
      { at: 0, p: pkt({ beatSeq: 1, hrBpm: 300 }) },
      { at: 800, p: pkt({ beatSeq: 2, rrMs: 100, motion: true }) },
    ];
    const d = diagnose(log, 900)!;
    expect(d.checks.find((c) => c.id === 'ranges')!.count).toBe(2);
    expect(d.motionPct).toBe(50);
  });

  it('measures ring clock drift against the phone', () => {
    const log: LoggedPacket[] = [
      { at: 0, p: pkt({ timestampMs: 1000, beatSeq: 1 }) },
      { at: 10_000, p: pkt({ timestampMs: 11_050, beatSeq: 2 }) },
    ];
    expect(diagnose(log, 10_000)!.clockDriftMs).toBe(50);
  });
});

describe('drainRate', () => {
  it('needs 5 minutes of history', () => {
    expect(drainRate([{ at: 0, p: pkt() }, { at: 60_000, p: pkt({ batteryPct: 79 }) }])).toBeNull();
  });

  it('gives %/hour from the battery trend', () => {
    const log = Array.from({ length: 31 }, (_, i) => ({ at: i * 60_000, p: pkt({ batteryPct: 90 - i / 3 }) }));
    expect(drainRate(log)).toBeCloseTo(20, 0);
  });
});

describe('hex', () => {
  it('formats bytes', () => {
    expect(hex(new Uint8Array([0, 10, 255]))).toBe('00 0A FF');
  });
});
