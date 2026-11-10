import { describe, expect, it } from 'vitest';
import { analyseRhythm, type RrBeat } from '../dsp/rhythm';
import { FINGER_ON } from './contract';
import type { LivePacket } from './packets';
import { readingState } from './readings';
import { SimulatedRing, TOUR_STEPS, tourStep } from './SimulatedRing';

const BOOT = 3_600_000;

describe('tourStep', () => {
  it('walks through normal, movement, finger off, irregular', () => {
    expect(tourStep(0)).toMatchObject({ step: 1, phase: 'normal', startsAt: 0, endsAt: 25_000 });
    expect(tourStep(25_000)).toMatchObject({ step: 2, phase: 'movement' });
    expect(tourStep(40_000)).toMatchObject({ step: 3, phase: 'finger-off', startsAt: 35_000, endsAt: 45_000 });
    expect(tourStep(600_000)).toMatchObject({ step: TOUR_STEPS.length, phase: 'irregular', endsAt: Infinity });
  });
});

describe('SimulatedRing tour', () => {
  /** Runs the tour; returns packets with their arrival time (ms since connect). */
  function runTour(seconds: number) {
    const sim = new SimulatedRing({ seed: 11, scenario: 'tour' });
    const packets: LivePacket[] = [];
    sim.onPacket((p) => packets.push(p));
    for (let t = 50; t <= seconds * 1000; t += 50) sim.advance(t);
    return packets.map((p) => ({ p, at: p.timestampMs - BOOT }));
  }

  const stateAt = (rows: ReturnType<typeof runTour>, ms: number) => {
    const last = [...rows].reverse().find((r) => r.at <= ms)!;
    return readingState(last.p, last.at, ms);
  };

  const beatsUntil = (rows: ReturnType<typeof runTour>, ms: number): RrBeat[] =>
    rows
      .filter((r) => r.at <= ms && r.p.rrMs !== null)
      .map((r) => ({ at: r.at, rrMs: r.p.rrMs!, beatSeq: r.p.beatSeq, motion: r.p.motion }));

  const rows = runTour(130);

  it('shows every reading state in order', () => {
    expect(stateAt(rows, 20_000)).toBe('ok');
    expect(stateAt(rows, 30_000)).toBe('hold');
    expect(stateAt(rows, 40_000)).toBe('place');
    expect(rows.filter((r) => r.at > 36_000 && r.at < 45_000).every((r) => r.p.fingerStatus !== FINGER_ON)).toBe(true);
    expect(stateAt(rows, 60_000)).toBe('ok');
  });

  it('warms up again after the ring goes back on', () => {
    const justBack = rows.find((r) => r.at > 45_000 && r.p.fingerStatus === FINGER_ON)!;
    expect(justBack.p.confidence).toBeLessThan(80);
  });

  it('flags a possible irregular rhythm once the 2-minute window is full, not before', () => {
    expect(analyseRhythm(beatsUntil(rows, 100_000), 100_000).status).toBe('collecting');
    expect(analyseRhythm(beatsUntil(rows, 128_000), 128_000).status).toBe('irregular');
  });
});
