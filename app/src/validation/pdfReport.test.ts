import { describe, expect, it } from 'vitest';
import type { ValidationSession } from './model';
import { buildAccuracyPdf, pdfSafe } from './pdfReport';

describe('pdfSafe', () => {
  it('replaces symbols the PDF fonts cannot draw', () => {
    expect(pdfSafe('SpO₂ − ring’s ≥ 80 · ok…')).toBe("SpO2 - ring's >= 80 - ok...");
    expect(pdfSafe('±0.5 °C')).toBe('±0.5 °C');
  });
});

describe('buildAccuracyPdf', () => {
  it('produces a PDF', async () => {
    const s = (id: string, hr: number): ValidationSession => ({
      id,
      volunteerId: id,
      startedAt: 0,
      endedAt: 120_000,
      plannedS: 120,
      source: 'sim',
      samples: [0, 1].map((i) => ({
        receivedAt: i,
        timestampMs: i,
        hrBpm: hr,
        spo2Pct: 97,
        confidence: 95,
        fingerStatus: 3,
        skinTempC: 34,
        rrMs: 800,
        motion: false,
        batteryPct: 80,
        beatSeq: i,
      })),
      reference: { hrBpm: 72, spo2Pct: 98, tempC: 36.6 },
    });
    const blob = await buildAccuracyPdf([s('V01', 70), s('V02', 75), s('V03', 71)], 'sim');
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(2000);
  });
});
