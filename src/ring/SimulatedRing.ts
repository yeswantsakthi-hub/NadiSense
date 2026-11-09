import { MockSignalModel, type Beat } from '../data/mockModel';
import { createRng, gaussian } from '../data/random';
import { FINGER_ON } from './contract';
import { encodeLivePacket, type LivePacket } from './packets';
import { PacketSource } from './RingSource';

export type SimScenario = 'normal' | 'irregular' | 'finger-off' | 'movement';
export const SIM_SCENARIOS: readonly SimScenario[] = ['normal', 'irregular', 'finger-off', 'movement'];

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
    this.model.scenario = scenario === 'irregular' ? 'irregular' : 'normal';
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
      scenario: this.scenarioValue === 'irregular' ? 'irregular' : 'normal',
    });
  }

  private fingerOn(): boolean {
    return this.scenarioValue !== 'finger-off';
  }

  private moving(t: number): boolean {
    if (this.scenarioValue === 'movement') return t % 20_000 > 12_000; // 8 s of movement every 20 s
    return this.model.motionLevel(t) > 0.2;
  }

  private emitBeat(beat: Beat): void {
    const previous = this.lastBeat;
    this.lastBeat = beat;
    if (!this.fingerOn() || !previous) return; // the pulse-ox detects no beats without a finger
    const rr = beat.r - previous.r;
    this.beatSeq = (this.beatSeq + 1) & 0xffff;
    this.recentRr = [...this.recentRr.slice(-3), rr];
    this.emit(beat.r, rr);
  }

  private emit(t: number, rrMs: number | null): void {
    this.lastEmit = t;
    const on = this.fingerOn();
    const moving = on && this.moving(t);
    const warm = Math.min(1, t / WARMUP_MS);
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
