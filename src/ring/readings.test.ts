import { describe, expect, it } from 'vitest';
import type { LivePacket } from './packets';
import { readingState, shownVitals } from './readings';

const ok: LivePacket = {
  timestampMs: 0,
  hrBpm: 72,
  spo2Pct: 98,
  confidence: 90,
  fingerStatus: 3,
  skinTempC: 34,
  rrMs: 830,
  motion: false,
  batteryPct: 80,
  beatSeq: 1,
};

describe('readingState', () => {
  it('shows readings only with the finger on, confidence ≥ 80 and no movement', () => {
    expect(readingState(ok, 1000, 1500)).toBe('ok');
    expect(readingState({ ...ok, confidence: 80 }, 1000, 1500)).toBe('ok');
    expect(readingState({ ...ok, confidence: 79 }, 1000, 1500)).toBe('hold');
    expect(readingState({ ...ok, motion: true }, 1000, 1500)).toBe('hold');
    expect(readingState({ ...ok, fingerStatus: 2 }, 1000, 1500)).toBe('place');
    expect(readingState({ ...ok, fingerStatus: 0, confidence: 99 }, 1000, 1500)).toBe('place');
  });

  it('reports no data when nothing has arrived recently', () => {
    expect(readingState(null, null, 1000)).toBe('no-data');
    expect(readingState(ok, 1000, 6000)).toBe('no-data');
  });
});

describe('shownVitals', () => {
  it('hides heart rate and SpO₂ unless the reading is trustworthy', () => {
    expect(shownVitals(ok, 0, 100)).toEqual({ hrBpm: 72, spo2Pct: 98 });
    expect(shownVitals({ ...ok, confidence: 50 }, 0, 100)).toEqual({ hrBpm: null, spo2Pct: null });
    expect(shownVitals({ ...ok, fingerStatus: 1 }, 0, 100)).toEqual({ hrBpm: null, spo2Pct: null });
  });
});
