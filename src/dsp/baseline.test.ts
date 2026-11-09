import { describe, expect, it } from 'vitest';
import { temperatureBaseline, temperatureDrift, type TempSession } from './baseline';

const s = (startedAt: number, avg: number, n = 4): TempSession => ({ startedAt, temp: { avg, n } });

describe('temperatureBaseline', () => {
  it('builds up over the first three usable sessions', () => {
    expect(temperatureBaseline([])).toEqual({ status: 'building', sessions: 0 });
    expect(temperatureBaseline([s(1, 34), s(2, 34.2)])).toEqual({ status: 'building', sessions: 2 });
  });

  it('averages the first three usable sessions by start time, ignoring later ones', () => {
    const sessions = [s(5, 39), s(3, 34.4), s(1, 34.0), s(2, 34.2), s(4, 30)];
    expect(temperatureBaseline(sessions)).toEqual({ status: 'ready', celsius: 34.2 });
  });

  it('skips sessions with too few temperature readings', () => {
    const sessions = [s(1, 20, 1), { startedAt: 2, temp: null }, s(3, 34), s(4, 34.1), s(5, 34.2)];
    expect(temperatureBaseline(sessions)).toEqual({ status: 'ready', celsius: 34.1 });
  });
});

describe('temperatureDrift', () => {
  it('rounds to a tenth of a degree, with sign', () => {
    expect(temperatureDrift(34.46, 34.2)).toBe(0.3);
    expect(temperatureDrift(33.9, 34.2)).toBe(-0.3);
    expect(temperatureDrift(34.2, 34.2)).toBe(0);
  });
});
