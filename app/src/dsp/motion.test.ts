import { describe, expect, it } from 'vitest';
import { MockSignalModel } from '../data/mockModel';
import {
  MOTION_OFF,
  MOTION_ON,
  accelMagnitude,
  flagMotionSegments,
  motionScore,
  nextMotionState,
} from './motion';

const still = (t: number) => ({ t, ax: 0, ay: 0, az: 1 });

describe('accelMagnitude', () => {
  it('is 1 g for a ring lying flat', () => {
    expect(accelMagnitude(still(0))).toBe(1);
    expect(accelMagnitude({ t: 0, ax: 3, ay: 4, az: 0 })).toBe(5);
  });
});

describe('motionScore', () => {
  it('is zero for a perfectly still hand and for too few samples', () => {
    expect(motionScore([still(0), still(20), still(40)])).toBe(0);
    expect(motionScore([still(0)])).toBe(0);
  });

  it('grows with movement', () => {
    const shaking = Array.from({ length: 25 }, (_, i) => ({ t: i * 20, ax: 0, ay: 0, az: 1 + (i % 2 ? 0.2 : -0.2) }));
    expect(motionScore(shaking)).toBeCloseTo(0.2, 2);
  });
});

describe('nextMotionState', () => {
  it('needs a high score to start and a low one to stop', () => {
    expect(nextMotionState(false, MOTION_ON - 0.001)).toBe(false);
    expect(nextMotionState(false, MOTION_ON + 0.001)).toBe(true);
    expect(nextMotionState(true, MOTION_OFF + 0.001)).toBe(true);
    expect(nextMotionState(true, MOTION_OFF - 0.001)).toBe(false);
  });
});

describe('flagMotionSegments', () => {
  it('finds the mock ring movement bursts and nothing else', () => {
    const m = new MockSignalModel({ seed: 9 });
    const imu = m.generateImu(3 * 60000);
    const segments = flagMotionSegments(imu);
    expect(segments.length).toBeGreaterThan(0);

    // every strong burst is covered
    for (const s of imu) {
      if (m.motionLevel(s.t) > 0.5) expect(segments.some((g) => s.t >= g.from && s.t <= g.to)).toBe(true);
    }
    // nothing is flagged while the hand is fully still
    for (const g of segments) {
      const inside = imu.filter((s) => s.t >= g.from && s.t <= g.to);
      expect(inside.some((s) => m.motionLevel(s.t) > 0)).toBe(true);
    }
  });

  it('returns no segments for a still recording', () => {
    expect(flagMotionSegments(Array.from({ length: 200 }, (_, i) => still(i * 20)))).toEqual([]);
  });
});
