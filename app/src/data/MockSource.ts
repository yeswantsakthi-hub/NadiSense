import { MockSignalModel, type Scenario } from './mockModel';
import type {
  EcgSample,
  ImuSample,
  PpgSample,
  SensorSource,
  TempSample,
  Unsubscribe,
} from './SensorSource';

const TICK_MS = 40;
const TEMP_PERIOD_MS = 60000;
/** If the browser paused us longer than this (background tab), drop the gap like a real BLE link would. */
const MAX_CATCH_UP_MS = 5000;

function subscribe<T>(set: Set<T>, cb: T): Unsubscribe {
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

/** Streams synthetic ring data in packet-sized batches, on the same clock semantics as the real ring. */
export class MockSource implements SensorSource {
  private model: MockSignalModel;
  private readonly seed: number;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempTimer: ReturnType<typeof setInterval> | null = null;
  private ecgTimer: ReturnType<typeof setTimeout> | null = null;
  private ecgResolve: (() => void) | null = null;
  private lastTemp: TempSample | null = null;

  private readonly ppgListeners = new Set<(s: PpgSample[]) => void>();
  private readonly ecgListeners = new Set<(s: EcgSample[]) => void>();
  private readonly tempListeners = new Set<(s: TempSample) => void>();
  private readonly imuListeners = new Set<(s: ImuSample[]) => void>();

  constructor(opts: { scenario?: Scenario; seed?: number } = {}) {
    this.seed = opts.seed ?? (Date.now() & 0xffff);
    this.model = new MockSignalModel({ seed: this.seed, scenario: opts.scenario });
  }

  get scenario(): Scenario {
    return this.model.scenario;
  }

  setScenario(scenario: Scenario): void {
    this.model.scenario = scenario;
  }

  get connected(): boolean {
    return this.timer !== null;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await new Promise((r) => setTimeout(r, 300)); // feels like pairing
    this.model = new MockSignalModel({ seed: this.seed, scenario: this.model.scenario });
    this.startedAt = performance.now();
    this.lastTemp = null;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.emitTemp();
    this.tempTimer = setInterval(() => this.emitTemp(), TEMP_PERIOD_MS);
  }

  async disconnect(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.tempTimer) clearInterval(this.tempTimer);
    if (this.ecgTimer) clearTimeout(this.ecgTimer);
    this.timer = this.tempTimer = this.ecgTimer = null;
    this.ecgResolve?.();
    this.ecgResolve = null;
  }

  onPpg(cb: (s: PpgSample[]) => void): Unsubscribe {
    return subscribe(this.ppgListeners, cb);
  }

  onEcg(cb: (s: EcgSample[]) => void): Unsubscribe {
    return subscribe(this.ecgListeners, cb);
  }

  onTemp(cb: (s: TempSample) => void): Unsubscribe {
    const unsubscribe = subscribe(this.tempListeners, cb);
    const latest = this.lastTemp;
    if (latest) {
      queueMicrotask(() => {
        if (this.tempListeners.has(cb)) cb(latest);
      });
    }
    return unsubscribe;
  }

  onImu(cb: (s: ImuSample[]) => void): Unsubscribe {
    return subscribe(this.imuListeners, cb);
  }

  startEcgSession(seconds: number): Promise<void> {
    if (!this.connected) return Promise.reject(new Error('Not connected'));
    this.ecgResolve?.();
    if (this.ecgTimer) clearTimeout(this.ecgTimer);
    this.model.startEcg(this.now(), seconds * 1000);
    return new Promise((resolve) => {
      this.ecgResolve = resolve;
      this.ecgTimer = setTimeout(() => {
        this.tick();
        this.ecgTimer = null;
        this.ecgResolve = null;
        resolve();
      }, seconds * 1000 + TICK_MS);
    });
  }

  async battery(): Promise<number> {
    const minutes = this.connected ? this.now() / 60000 : 0;
    return Math.max(5, 86 - Math.floor(minutes / 10));
  }

  private now(): number {
    return performance.now() - this.startedAt;
  }

  private tick(): void {
    const now = this.now();
    if (now - this.model.ppgCursor > MAX_CATCH_UP_MS) this.model.skipTo(now - TICK_MS);

    const ppg = this.model.generatePpg(now);
    if (ppg.length) this.ppgListeners.forEach((cb) => cb(ppg));
    const imu = this.model.generateImu(now);
    if (imu.length) this.imuListeners.forEach((cb) => cb(imu));
    if (this.model.ecgActive) {
      const ecg = this.model.generateEcg(now);
      if (ecg.length) this.ecgListeners.forEach((cb) => cb(ecg));
    }
  }

  private emitTemp(): void {
    const t = this.now();
    const sample = { t, celsius: this.model.temperature(t) };
    this.lastTemp = sample;
    this.tempListeners.forEach((cb) => cb(sample));
  }
}
