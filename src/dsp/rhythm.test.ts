import { describe, expect, it } from 'vitest';
import { SimulatedRing, type SimScenario } from '../ring/SimulatedRing';
import { analyseRhythm, cleanDiffs, pnn50, rmssd, type RrBeat } from './rhythm';

/** Beats with the given intervals, arriving back to back from t=0. */
function series(rr: number[], opts: { motionAt?: number[]; skipSeqAt?: number[] } = {}): RrBeat[] {
  let at = 0;
  let seq = 100;
  return rr.map((rrMs, i) => {
    at += rrMs;
    seq += opts.skipSeqAt?.includes(i) ? 3 : 1;
    return { at, rrMs, beatSeq: seq & 0xffff, motion: opts.motionAt?.includes(i) ?? false };
  });
}

describe('rmssd and pnn50', () => {
  it('match hand-computed values', () => {
    const diffs = [10, -20, 60, -70];
    expect(rmssd(diffs)).toBeCloseTo(Math.sqrt((100 + 400 + 3600 + 4900) / 4));
    expect(pnn50(diffs)).toBe(50);
    expect(rmssd([])).toBe(0);
    expect(pnn50([])).toBe(0);
  });
});

describe('cleanDiffs', () => {
  it('only compares consecutive, still, plausible beats', () => {
    const beats = series([800, 810, 820, 830, 840, 3000, 850], { motionAt: [2], skipSeqAt: [4] });
    // pairs: (0,1) ok; (1,2) motion; (2,3) motion; (3,4) seq gap; (4,5) 3000 ms implausible; (5,6) implausible
    expect(cleanDiffs(beats).diffs).toEqual([10]);
  });

  it('counts beats across the 16-bit beat_seq wrap', () => {
    const beats: RrBeat[] = [
      { at: 0, rrMs: 800, beatSeq: 65535, motion: false },
      { at: 800, rrMs: 830, beatSeq: 0, motion: false },
    ];
    expect(cleanDiffs(beats).diffs).toEqual([30]);
  });
});

describe('analyseRhythm', () => {
  const steady = Array.from({ length: 170 }, (_, i) => 850 + (i % 2 ? 15 : -15));
  const chaotic = Array.from({ length: 170 }, (_, i) => 520 + ((i * 7919) % 11) * 70); // 520–1220 ms, jumpy

  it('waits for a full 2 minutes of clean beats', () => {
    const r = analyseRhythm(series(steady.slice(0, 60)), 60 * 850);
    expect(r.status).toBe('collecting');
    if (r.status === 'collecting') expect(r.progress).toBeGreaterThan(0.3);
  });

  it('calls a steady rhythm regular', () => {
    const beats = series(steady);
    const r = analyseRhythm(beats, beats.at(-1)!.at);
    expect(r.status).toBe('regular');
    if (r.status !== 'collecting') {
      expect(r.rmssdMs).toBe(30);
      expect(r.pnn50).toBe(0);
      expect(r.meanHr).toBe(71);
    }
  });

  it('flags highly irregular intervals', () => {
    const beats = series(chaotic);
    const r = analyseRhythm(beats, beats.at(-1)!.at);
    expect(r.status).toBe('irregular');
  });

  it('ignores movement: chaos during motion does not trigger a flag', () => {
    const mixed = steady.map((rr, i) => (i % 3 === 0 ? chaotic[i]! : rr));
    const motionAt = mixed.map((_, i) => i).filter((i) => i % 3 === 0 || i % 3 === 1);
    const beats = series(mixed, { motionAt });
    const r = analyseRhythm(beats, beats.at(-1)!.at);
    expect(r.status).toBe('collecting'); // too few clean pairs left
  });

  it('agrees with the simulator: normal is regular, irregular is flagged', () => {
    const run = (scenario: SimScenario) => {
      const sim = new SimulatedRing({ seed: 21, scenario });
      const beats: RrBeat[] = [];
      sim.onPacket((p) => {
        if (p.rrMs !== null) beats.push({ at: p.timestampMs, rrMs: p.rrMs, beatSeq: p.beatSeq, motion: p.motion });
      });
      for (let t = 50; t <= 150_000; t += 50) sim.advance(t);
      return analyseRhythm(beats, beats.at(-1)!.at).status;
    };
    expect(run('normal')).toBe('regular');
    expect(run('irregular')).toBe('irregular');
  });
});
