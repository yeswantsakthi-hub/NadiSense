import { describe, expect, it } from 'vitest';
import { agreementPoints, metricAccuracy, sessionsFor } from './accuracy';
import type { ValidationSample, ValidationSession } from './model';

const sample = (hr: number, over: Partial<ValidationSample> = {}): ValidationSample => ({
  receivedAt: 0,
  timestampMs: 0,
  hrBpm: hr,
  spo2Pct: 97,
  confidence: 95,
  fingerStatus: 3,
  skinTempC: 34,
  rrMs: 800,
  motion: false,
  batteryPct: 80,
  beatSeq: 1,
  ...over,
});

const session = (id: string, ringHr: number, refHr: number | null, over: Partial<ValidationSession> = {}): ValidationSession => ({
  id,
  volunteerId: id.toUpperCase(),
  startedAt: Number(id.replace(/\D/g, '')) || 0,
  endedAt: 0,
  plannedS: 120,
  source: 'ring',
  samples: [sample(ringHr), sample(ringHr)],
  reference: { hrBpm: refHr, spo2Pct: 98, tempC: null },
  ...over,
});

describe('agreementPoints', () => {
  it('pairs the ring mean with the reference and skips sessions missing either', () => {
    const pts = agreementPoints(
      [session('v1', 72, 70), session('v2', 80, null), session('v3', 60, 64, { samples: [sample(60, { confidence: 10 })] })],
      'hr',
    );
    expect(pts).toEqual([{ volunteerId: 'V1', sessionId: 'v1', ring: 72, reference: 70, mean: 71, diff: 2 }]);
  });
});

describe('metricAccuracy', () => {
  it('returns null without paired sessions', () => {
    expect(metricAccuracy([session('v1', 70, null)], 'hr')).toBeNull();
  });

  it('computes bias, SD, limits of agreement, MAE, RMSE and % within tolerance', () => {
    // diffs: +2, -2, +4, -8
    const a = metricAccuracy(
      [session('v1', 72, 70), session('v2', 68, 70), session('v3', 74, 70), session('v4', 62, 70)],
      'hr',
    )!;
    expect(a.n).toBe(4);
    expect(a.bias).toBe(-1);
    // sample SD of [2,-2,4,-8] around -1: sqrt((9+1+25+49)/3) = sqrt(28)
    expect(a.sd).toBeCloseTo(5.29, 2);
    expect(a.loaLow).toBeCloseTo(-1 - 1.96 * Math.sqrt(28), 1);
    expect(a.loaHigh).toBeCloseTo(-1 + 1.96 * Math.sqrt(28), 1);
    expect(a.mae).toBe(4);
    expect(a.rmse).toBeCloseTo(Math.sqrt(88 / 4), 2);
    expect(a.withinPct).toBe(75); // |−8| > 5
    expect(a.tolerance).toBe(5);
  });

  it('has no SD or limits with a single session', () => {
    const a = metricAccuracy([session('v1', 72, 70)], 'hr')!;
    expect(a.sd).toBeNull();
    expect(a.loaLow).toBeNull();
    expect(a.bias).toBe(2);
  });

  it('counts a difference exactly at the tolerance as within', () => {
    expect(metricAccuracy([session('v1', 75, 70)], 'hr')!.withinPct).toBe(100);
  });

  it('works for SpO₂ with its own tolerance', () => {
    const a = metricAccuracy([session('v1', 72, 70)], 'spo2')!;
    expect(a.bias).toBe(-1); // ring 97 vs reference 98
    expect(a.tolerance).toBe(3);
  });
});

describe('sessionsFor', () => {
  it('keeps one source, oldest first', () => {
    const out = sessionsFor(
      [session('v3', 70, 70), session('v1', 70, 70), session('v2', 70, 70, { source: 'sim' })],
      'ring',
    );
    expect(out.map((s) => s.id)).toEqual(['v1', 'v3']);
  });
});
