import { describe, expect, it } from 'vitest';
import { MockSignalModel, ppgPulse } from './mockModel';

const TEN_MIN = 10 * 60 * 1000;

describe('MockSignalModel', () => {
  it('produces PPG at 400 Hz and IMU at 50 Hz on an even time grid', () => {
    const m = new MockSignalModel({ seed: 7 });
    const ppg = m.generatePpg(10000);
    const imu = m.generateImu(10000);
    expect(ppg).toHaveLength(4000);
    expect(imu).toHaveLength(500);
    expect(ppg[1]!.t - ppg[0]!.t).toBeCloseTo(2.5);
    expect(imu[1]!.t - imu[0]!.t).toBeCloseTo(20);
  });

  it('keeps heart rate between 60 and 80 bpm in the normal scenario', () => {
    const beats = new MockSignalModel({ seed: 3 }).beatsBetween(0, TEN_MIN);
    for (const b of beats) {
      const bpm = 60000 / b.rr;
      expect(bpm).toBeGreaterThanOrEqual(60);
      expect(bpm).toBeLessThanOrEqual(80);
    }
    expect(beats.length).toBeGreaterThan(600);
    expect(beats.length).toBeLessThan(800);
  });

  it('places the PPG foot 200–250 ms after each ECG R-peak', () => {
    for (const scenario of ['normal', 'irregular', 'apnea-night'] as const) {
      const beats = new MockSignalModel({ seed: 5, scenario }).beatsBetween(0, TEN_MIN);
      for (const b of beats) {
        expect(b.pat).toBeGreaterThanOrEqual(200);
        expect(b.pat).toBeLessThanOrEqual(250);
      }
    }
  });

  it('makes beat-to-beat changes much larger in the irregular scenario', () => {
    // RMSSD normalised by mean RR: slow HR drift barely moves it, random intervals do
    const nRmssd = (scenario: 'normal' | 'irregular') => {
      const rr = new MockSignalModel({ seed: 11, scenario }).beatsBetween(0, TEN_MIN).map((b) => b.rr);
      const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
      let sumSq = 0;
      for (let i = 1; i < rr.length; i++) sumSq += (rr[i]! - rr[i - 1]!) ** 2;
      return Math.sqrt(sumSq / (rr.length - 1)) / mean;
    };
    expect(nRmssd('normal')).toBeLessThan(0.05);
    expect(nRmssd('irregular')).toBeGreaterThan(0.15);
  });

  it('puts each ECG R-peak at the ground-truth beat time', () => {
    const m = new MockSignalModel({ seed: 2 });
    m.startEcg(1000, 30000);
    const ecg = m.generateEcg(31000);
    expect(ecg).toHaveLength(30 * 250);
    const beats = m.beatsBetween(1200, 30800);
    for (const b of beats) {
      const near = ecg.filter((s) => Math.abs(s.t - b.r) <= 60);
      const peak = near.reduce((best, s) => (s.v > best.v ? s : best));
      expect(Math.abs(peak.t - b.r)).toBeLessThanOrEqual(4);
      expect(peak.v).toBeGreaterThan(0.8);
    }
    expect(m.ecgActive).toBe(false);
  });

  it('puts the PPG systolic peak about 140 ms after the foot', () => {
    const m = new MockSignalModel({ seed: 4 });
    const beats = m.beatsBetween(0, 15000); // first motion burst starts after 20 s
    const ppg = m.generatePpg(16000);
    for (const b of beats.slice(1, -2)) {
      const foot = b.r + b.pat;
      const win = ppg.filter((s) => s.t >= foot && s.t <= foot + 300);
      // light dips as blood volume rises, so the systolic peak is the IR minimum
      const peak = win.reduce((best, s) => (s.ir < best.ir ? s : best));
      expect(peak.t - foot).toBeGreaterThan(100);
      expect(peak.t - foot).toBeLessThan(180);
    }
  });

  it('shapes each pulse with a dicrotic notch before the reflected wave', () => {
    const at = (ms: number) => ppgPulse(ms / 1000, 857);
    expect(at(140)).toBeGreaterThan(0.95);
    expect(at(270)).toBeLessThan(at(380));
    expect(at(380)).toBeLessThan(at(140));
    expect(at(0)).toBeLessThan(0.02);
  });

  it('dips SpO2 below 90 % only in the apnea-night scenario', () => {
    const minSpo2 = (scenario: 'normal' | 'apnea-night') => {
      const m = new MockSignalModel({ scenario });
      let min = 100;
      for (let t = 0; t < 5 * 60000; t += 500) min = Math.min(min, m.spo2(t));
      return min;
    };
    expect(minSpo2('normal')).toBeGreaterThan(96);
    expect(minSpo2('apnea-night')).toBeLessThan(90);
  });

  it('includes occasional motion bursts that show up on the IMU', () => {
    const m = new MockSignalModel({ seed: 9 });
    const imu = m.generateImu(3 * 60000);
    const moving = imu.filter((s) => m.motionLevel(s.t) > 0.5);
    const still = imu.filter((s) => m.motionLevel(s.t) === 0);
    expect(moving.length).toBeGreaterThan(0);
    expect(still.length / imu.length).toBeGreaterThan(0.85);
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(spread(still.map((s) => s.ax))).toBeLessThan(0.05);
    expect(spread(moving.map((s) => s.ax))).toBeGreaterThan(0.2);
  });

  it('keeps skin temperature within 36.4–36.8 °C', () => {
    const m = new MockSignalModel();
    for (let t = 0; t < 24 * 3600000; t += 60000) {
      expect(m.temperature(t)).toBeGreaterThanOrEqual(36.4);
      expect(m.temperature(t)).toBeLessThanOrEqual(36.8);
    }
  });

  it('gives identical output however the stream is chunked', () => {
    const a = new MockSignalModel({ seed: 42 });
    const b = new MockSignalModel({ seed: 42 });
    const whole = a.generatePpg(5000);
    const parts = [...b.generatePpg(1234), ...b.generatePpg(1240), ...b.generatePpg(5000)];
    expect(parts).toEqual(whole);
  });
});
