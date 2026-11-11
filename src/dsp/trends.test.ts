import { describe, expect, it } from 'vitest';
import type { SessionSummary } from '../cloud/model';
import { hasData, sessionTrend } from './trends';

const session = (id: string, startedAt: number, over: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  day: '2026-11-10',
  startedAt,
  endedAt: startedAt + 600_000,
  durationS: 600,
  source: 'ble',
  scenario: null,
  motionEvents: 0,
  flaggedS: 0,
  temp: { min: 33.8, max: 34.2, avg: 34, n: 10 },
  battery: null,
  vitals: { hr: 70, spo2: 97, hrv: null, resp: null },
  ...over,
});

describe('sessionTrend', () => {
  it('orders sessions oldest first and keeps those since the cut-off', () => {
    const pts = sessionTrend([session('c', 3000), session('a', 1000), session('b', 2000)], 2000);
    expect(pts.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('has no temperature drift until the 3-session baseline exists', () => {
    const pts = sessionTrend([session('a', 1), session('b', 2)], 0);
    expect(pts.every((p) => p.driftC === null)).toBe(true);
  });

  it('shows drift from the baseline of the first three sessions, even when they are before the cut-off', () => {
    const all = [
      session('a', 1, { temp: { min: 0, max: 0, avg: 34, n: 5 } }),
      session('b', 2, { temp: { min: 0, max: 0, avg: 34.2, n: 5 } }),
      session('c', 3, { temp: { min: 0, max: 0, avg: 33.8, n: 5 } }),
      session('d', 10, { temp: { min: 0, max: 0, avg: 34.6, n: 5 } }),
    ];
    const pts = sessionTrend(all, 10);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.driftC).toBe(0.6);
  });

  it('carries rhythm results and marks flagged sessions', () => {
    const pts = sessionTrend(
      [
        session('a', 1, { rhythm: { status: 'regular', rmssdMs: 35, pnn50: 8 } }),
        session('b', 2, { rhythm: { status: 'irregular', rmssdMs: 180, pnn50: 70 } }),
        session('c', 3),
      ],
      0,
    );
    expect(pts.map((p) => [p.rmssdMs, p.irregular])).toEqual([
      [35, false],
      [180, true],
      [null, false],
    ]);
  });
});

describe('hasData', () => {
  it('is false when every point lacks the field', () => {
    const pts = sessionTrend([session('a', 1, { vitals: { hr: null, spo2: null, hrv: null, resp: null } })], 0);
    expect(hasData(pts, 'hr')).toBe(false);
    expect(hasData(pts, 'rmssdMs')).toBe(false);
    expect(hasData(sessionTrend([session('b', 1)], 0), 'hr')).toBe(true);
  });
});
