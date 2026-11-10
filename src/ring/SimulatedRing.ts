import { MockSignalModel, type Beat } from '../data/mockModel';
import { createRng, gaussian } from '../data/random';
import { FINGER_ON } from './contract';
import { encodeLivePacket, type LivePacket } from './packets';
import { PacketSource } from './RingSource';

export type SimScenario = 'normal' | 'irregular' | 'finger-off' | 'movement' | 'tour';
export const SIM_SCENARIOS: readonly SimScenario[] = ['normal', 'irregular', 'finger-off', 'movement', 'tour'];

type Phase = Exclude<SimScenario, 'tour'>;

/**
 * Demo tour for the Stage 3 video: every state of the app in one run. The rhythm result still needs
 * its full 2-minute window, so the irregular flag appears about 2 minutes after the start.
 */
export const TOUR_STEPS: readonly { phase: Phase; untilMs: number }[] = [
  { phase: 'normal', untilMs: 25_000 },
  { phase: 'movement', untilMs: 35_000 },
  { phase: 'finger-off', untilMs: 45_000 },
  { phase: 'irregular', untilMs: Infinity },
];

/** Which tour step is running `t` ms after the tour started (step is 1-based). */
export function tourStep(t: number): { step: number; phase: Phase; startsAt: number; endsAt: number } {
  let startsAt = 0;
  for (let i = 0; i < TOUR_STEPS.length; i++) {
    const s = TOUR_STEPS[i]!;
    if (t < s.untilMs) return { step: i + 1, phase: s.phase, startsAt, endsAt: s.untilMs };
    startsAt = s.untilMs;
  }
  const last = TOUR_STEPS[TOUR_STEPS.length - 1]!;
  return { step: TOUR_STEPS.length, phase: last.phase, startsAt, endsAt: Infinity };
}

const TICK_MS = 50;
/** Like the firmware: one packet per beat, and a keep-alive if no beat for this long. */
const KEEPALIVE_MS = 1000;
/** The pulse-ox needs a few seconds after the finger goes on before its confidence is high. */
const WARMUP_MS = 6000;
/** Ring uptime at "connect", so timestamps look like a real ring's. */
const BOOT_OFFSET_MS = 3_600_000;

/**
 * Simulated ring for demos without hardware. Generates realistic beats, then encodes exactly the
 * 16-byte live packets the firmware sends, which go through the same parser as the real ring.
 */
export class SimulatedRing extends PacketSource {
  readonly kind = 'sim' as const;
  private scenarioValue: SimScenario;
  private readonly seed: number;
  private readonly clock: () => number;
  private model: MockSignalModel;
  private rng: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private cursor = 0;
  private lastBeat: Beat | null = null;
  private lastEmit = -Infinity;
  private beatSeq = 0;
  private recentRr: number[] = [];
  /** Ms since connect when the tour (re)started. */
  private tourStart = 0;

  constructor(opts: { scenario?: SimScenario; seed?: number; clock?: () => number } = {}) {
    super();
    this.scenarioValue = opts.scenario ?? 'normal';
    this.seed = opts.seed ?? (Date.now() & 0xffff);
    this.clock = opts.clock ?? Date.now;
    this.model = this.newModel();
    this.rng = createRng(this.seed + 7);
  }

  get scenario(): SimScenario {
    return this.scenarioValue;
  }

  setScenario(scenario: SimScenario): void {
    this.scenarioValue = scenario;
    if (scenario === 'tour' && this.timer) this.tourStart = this.clock() - this.startedAt;
    this.model.scenario = this.phase(this.cursor) === 'irregular' ? 'irregular' : 'normal';
  }

  /** The tour step now, or null when another scenario is running. */
  tourStatus(): ReturnType<typeof tourStep> | null {
    if (this.scenarioValue !== 'tour' || !this.timer) return null;
    return tourStep(this.clock() - this.startedAt - this.tourStart);
  }

  /** What the simulated finger is doing at `t` (ms since connect). */
  private phase(t: number): Phase {
    return this.scenarioValue === 'tour' ? tourStep(t - this.tourStart).phase : this.scenarioValue;
  }

  async connect(): Promise<void> {
    if (this.timer) return;
    this.setStatus('connecting');
    await new Promise((r) => setTimeout(r, 400)); // feels like pairing
    this.model = this.newModel();
    this.rng = createRng(this.seed + 7);
    this.startedAt = this.clock();
    this.cursor = 0;
    this.lastBeat = null;
    this.lastEmit = -Infinity;
    this.recentRr = [];
    this.tourStart = 0;
    this.setStatus('connected');
    this.timer = setInterval(() => this.advance(), TICK_MS);
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.setStatus('disconnected');
  }

  /** Emits every packet due up to now. Public so tests can drive it without timers. */
  advance(now = this.clock() - this.startedAt): void {
    this.model.scenario = this.phase(this.cursor) === 'irregular' ? 'irregular' : 'normal';
    for (const beat of this.model.beatsBetween(this.cursor, now)) {
      this.emitBeat(beat);
    }
    this.cursor = now;
    if (now - this.lastEmit >= KEEPALIVE_MS) this.emit(now, null);
    if (Math.floor(now / 1000) !== Math.floor((now - TICK_MS) / 1000)) this.model.skipTo(now - 5000);
  }

  private newModel(): MockSignalModel {
    return new MockSignalModel({
      seed: this.seed,
      scenario: this.phase(0) === 'irregular' ? 'irregular' : 'normal',
    });
  }

  private fingerOn(t: number): boolean {
    return this.phase(t) !== 'finger-off';
  }

  private moving(t: number): boolean {
    if (this.scenarioValue === 'tour') return this.phase(t) === 'movement';
    if (this.scenarioValue === 'movement') return t % 20_000 > 12_000; // 8 s of movement every 20 s
    return this.model.motionLevel(t) > 0.2;
  }

  /** When the finger last went on, so the pulse-ox warms up again after the ring is put back. */
  private onSince(t: number): number {
    if (this.scenarioValue !== 'tour') return 0;
    const s = tourStep(t - this.tourStart);
    const prev = TOUR_STEPS[s.step - 2];
    return prev?.phase === 'finger-off' ? this.tourStart + s.startsAt : 0;
  }

  private emitBeat(beat: Beat): void {
    const previous = this.lastBeat;
    this.lastBeat = beat;
    if (!this.fingerOn(beat.r) || !previous) return; // the pulse-ox detects no beats without a finger
    const rr = beat.r - previous.r;
    this.beatSeq = (this.beatSeq + 1) & 0xffff;
    this.recentRr = [...this.recentRr.slice(-3), rr];
    this.emit(beat.r, rr);
  }

  private emit(t: number, rrMs: number | null): void {
    this.lastEmit = t;
    const on = this.fingerOn(t);
    const moving = on && this.moving(t);
    const warm = Math.min(1, (t - this.onSince(t)) / WARMUP_MS);
    const noise = gaussian(this.rng);
    const confidence = !on ? 0 : moving ? 45 + 10 * this.rng() : Math.round(40 + 55 * warm + 3 * noise);
    const meanRr = this.recentRr.length ? this.recentRr.reduce((a, b) => a + b, 0) / this.recentRr.length : null;

    const packet: LivePacket = {
      timestampMs: BOOT_OFFSET_MS + Math.round(t),
      hrBpm: on && meanRr ? Math.round(60000 / meanRr) : null,
      spo2Pct: on && t > 3000 ? Math.round(this.model.spo2(t) + 0.6 * noise) : null,
      confidence: Math.max(0, Math.min(100, confidence)),
      fingerStatus: on ? FINGER_ON : 1,
      // Skin on a finger reads cooler than core temperature.
      skinTempC: on ? Math.round((this.model.temperature(t) - 2.4 + 0.02 * noise) * 100) / 100 : null,
      rrMs: on ? rrMs : null,
      motion: moving,
      batteryPct: Math.max(5, 87 - Math.floor(t / 600_000)),
      beatSeq: this.beatSeq,
    };
    this.receive(encodeLivePacket(packet));
  }
}
