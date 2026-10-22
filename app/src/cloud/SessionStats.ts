import { localDay, type SessionSummary } from './model';

/** Accumulates what happens during one ring session into a SessionSummary. No timers, no I/O. */
export class SessionStats {
  readonly id: string;
  private readonly startedAt: number;
  private motionEvents = 0;
  private flaggedMs = 0;
  private motionSince: number | null = null;
  private tempMin = Infinity;
  private tempMax = -Infinity;
  private tempSum = 0;
  private tempN = 0;
  private batteryStart: number | null = null;
  private batteryEnd: number | null = null;

  constructor(
    private readonly source: SessionSummary['source'],
    private readonly scenario: string | null,
    startedAt: number,
    idSuffix = Math.random().toString(36).slice(2, 6),
  ) {
    this.startedAt = startedAt;
    this.id = `${startedAt}-${idSuffix}`;
  }

  motionStart(at: number): void {
    if (this.motionSince !== null) return;
    this.motionSince = at;
    this.motionEvents += 1;
  }

  motionEnd(at: number): void {
    if (this.motionSince === null) return;
    this.flaggedMs += Math.max(0, at - this.motionSince);
    this.motionSince = null;
  }

  temperature(celsius: number): void {
    this.tempMin = Math.min(this.tempMin, celsius);
    this.tempMax = Math.max(this.tempMax, celsius);
    this.tempSum += celsius;
    this.tempN += 1;
  }

  battery(percent: number): void {
    this.batteryStart ??= percent;
    this.batteryEnd = percent;
  }

  /** Summary as of `now`; an ongoing movement counts up to `now`. */
  summary(now: number): SessionSummary {
    const flagged = this.flaggedMs + (this.motionSince !== null ? Math.max(0, now - this.motionSince) : 0);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    return {
      id: this.id,
      day: localDay(this.startedAt),
      startedAt: this.startedAt,
      endedAt: now,
      durationS: Math.round((now - this.startedAt) / 1000),
      source: this.source,
      scenario: this.scenario,
      motionEvents: this.motionEvents,
      flaggedS: Math.round(flagged / 1000),
      temp: this.tempN
        ? { min: this.tempMin, max: this.tempMax, avg: round2(this.tempSum / this.tempN), n: this.tempN }
        : null,
      battery: this.batteryStart !== null && this.batteryEnd !== null ? { start: this.batteryStart, end: this.batteryEnd } : null,
      vitals: { hr: null, spo2: null, hrv: null, resp: null },
    };
  }
}
