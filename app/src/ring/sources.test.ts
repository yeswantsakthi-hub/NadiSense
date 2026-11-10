import { afterEach, describe, expect, it, vi } from 'vitest';
import { RingCommand, RING_COMMAND_UUID, RING_LIVE_UUID, RING_SERVICE_UUID } from './contract';
import { BluetoothRing, RingError } from './BluetoothRing';
import { encodeLivePacket, type LivePacket } from './packets';
import { SimulatedRing } from './SimulatedRing';
import type { LinkStatus } from './RingSource';
import type { BleDevice, BluetoothApi, GattCharacteristic, GattServer, GattService } from './webBluetooth';

function collect(sim: SimulatedRing): LivePacket[] {
  const out: LivePacket[] = [];
  sim.onPacket((p) => out.push(p));
  return out;
}

/** Drives the simulator for `seconds` of simulated time in 50 ms steps. */
function run(sim: SimulatedRing, seconds: number): void {
  for (let t = 50; t <= seconds * 1000; t += 50) sim.advance(t);
}

describe('SimulatedRing', () => {
  it('sends one packet per beat with consecutive beat numbers and real intervals', () => {
    const sim = new SimulatedRing({ seed: 3 });
    const packets = collect(sim);
    run(sim, 60);
    const beats = packets.filter((p) => p.rrMs !== null);
    expect(beats.length).toBeGreaterThan(55);
    expect(beats.length).toBeLessThan(85);
    beats.slice(1).forEach((p, i) => expect(p.beatSeq).toBe((beats[i]!.beatSeq + 1) & 0xffff));
    for (const p of beats) {
      expect(p.rrMs!).toBeGreaterThanOrEqual(740);
      expect(p.rrMs!).toBeLessThanOrEqual(1010);
    }
  });

  it('never goes more than a second without a packet', () => {
    const sim = new SimulatedRing({ seed: 4, scenario: 'finger-off' });
    const packets = collect(sim);
    run(sim, 20);
    expect(packets.length).toBeGreaterThanOrEqual(19);
    for (let i = 1; i < packets.length; i++) {
      expect(packets[i]!.timestampMs - packets[i - 1]!.timestampMs).toBeLessThanOrEqual(1050);
    }
  });

  it('reports a confident reading on the finger after warm-up', () => {
    const sim = new SimulatedRing({ seed: 5 });
    const packets = collect(sim);
    run(sim, 15);
    const early = packets.filter((p) => p.timestampMs - packets[0]!.timestampMs < 2000);
    const late = packets.filter((p) => p.timestampMs - packets[0]!.timestampMs > 8000 && !p.motion);
    expect(early.every((p) => p.confidence < 80)).toBe(true);
    expect(late.every((p) => p.fingerStatus === 3 && p.confidence >= 80)).toBe(true);
    expect(late.every((p) => p.hrBpm! >= 55 && p.hrBpm! <= 85 && p.spo2Pct! >= 95)).toBe(true);
    expect(late.every((p) => p.skinTempC! > 33 && p.skinTempC! < 35)).toBe(true);
  });

  it('has no readings and no beats when the finger is off', () => {
    const sim = new SimulatedRing({ seed: 6, scenario: 'finger-off' });
    const packets = collect(sim);
    run(sim, 10);
    expect(packets.every((p) => p.fingerStatus !== 3 && p.hrBpm === null && p.rrMs === null)).toBe(true);
  });

  it('flags movement and lowers confidence in the movement scenario', () => {
    const sim = new SimulatedRing({ seed: 7, scenario: 'movement' });
    const packets = collect(sim);
    run(sim, 40);
    const moving = packets.filter((p) => p.motion);
    expect(moving.length).toBeGreaterThan(10);
    expect(moving.every((p) => p.confidence < 80)).toBe(true);
  });

  it('makes beat intervals much more variable in the irregular scenario', () => {
    const variability = (scenario: 'normal' | 'irregular') => {
      const sim = new SimulatedRing({ seed: 8, scenario });
      const rr = collect(sim);
      run(sim, 120);
      const v = rr.filter((p) => p.rrMs !== null).map((p) => p.rrMs!);
      const diffs = v.slice(1).map((x, i) => Math.abs(x - v[i]!));
      return diffs.filter((d) => d > 50).length / diffs.length;
    };
    expect(variability('normal')).toBeLessThan(0.15);
    expect(variability('irregular')).toBeGreaterThan(0.5);
  });
});

// ---- fake Web Bluetooth ring --------------------------------------------------------------

class FakeChar extends EventTarget implements GattCharacteristic {
  value: DataView | null = null;
  writes: number[][] = [];
  async startNotifications() {
    return this;
  }
  async writeValue(v: Uint8Array) {
    this.writes.push([...v]);
  }
  async writeValueWithResponse(v: Uint8Array) {
    this.writes.push([...v]);
  }
  notify(bytes: Uint8Array) {
    this.value = new DataView(bytes.buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

class FakeRing extends EventTarget implements BleDevice {
  readonly id = 'ring-1';
  readonly name = 'NadiSense';
  readonly live = new FakeChar();
  readonly command = new FakeChar();
  failConnects = 0;
  connectCalls = 0;
  connected = false;
  readonly gatt: GattServer;
  constructor() {
    super();
    const service: GattService = {
      getCharacteristic: async (uuid) => {
        if (uuid === RING_LIVE_UUID) return this.live;
        if (uuid === RING_COMMAND_UUID) return this.command;
        throw new Error('unknown characteristic');
      },
    };
    const server: GattServer = {
      get connected() {
        return ring.connected;
      },
      connect: async () => {
        this.connectCalls += 1;
        if (this.failConnects > 0) {
          this.failConnects -= 1;
          throw new Error('GATT error');
        }
        this.connected = true;
        return server;
      },
      disconnect: () => {
        this.connected = false;
      },
      getPrimaryService: async (uuid) => {
        if (uuid !== RING_SERVICE_UUID) throw new Error('unknown service');
        return service;
      },
    };
    const ring = this;
    this.gatt = server;
  }
  drop() {
    this.connected = false;
    this.dispatchEvent(new Event('gattserverdisconnected'));
  }
}

function api(device: BleDevice | Error): BluetoothApi & { requested: number } {
  const a = {
    requested: 0,
    requestDevice: async () => {
      a.requested += 1;
      if (device instanceof Error) throw device;
      return device;
    },
    getAvailability: async () => true,
  };
  return a;
}

const packet: LivePacket = {
  timestampMs: 1000,
  hrBpm: 70,
  spo2Pct: 97,
  confidence: 95,
  fingerStatus: 3,
  skinTempC: 34,
  rrMs: 857,
  motion: false,
  batteryPct: 80,
  beatSeq: 1,
};

describe('BluetoothRing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects, syncs the clock, starts streaming and delivers parsed packets', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T00:00:00Z'));
    const fake = new FakeRing();
    const ring = new BluetoothRing(api(fake));
    const statuses: LinkStatus[] = [];
    ring.onStatus((s) => statuses.push(s));
    const got: LivePacket[] = [];
    ring.onPacket((p) => got.push(p));

    await ring.connect();
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(fake.command.writes).toEqual([
      [RingCommand.SET_TIME, 0x00, 0x0d, 0xf1, 0x6a],
      [RingCommand.START],
    ]);

    fake.live.notify(encodeLivePacket(packet));
    fake.live.notify(new Uint8Array(5)); // garbage is dropped, not thrown
    expect(got).toEqual([packet]);
    expect(ring.badPackets).toBe(1);
  });

  it('reconnects with back-off after the link drops, and resumes streaming', async () => {
    vi.useFakeTimers();
    const fake = new FakeRing();
    const ring = new BluetoothRing(api(fake));
    const statuses: LinkStatus[] = [];
    ring.onStatus((s) => statuses.push(s));
    await ring.connect();

    fake.failConnects = 2;
    fake.drop();
    expect(ring.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000); // attempt 1 fails
    await vi.advanceTimersByTimeAsync(2000); // attempt 2 fails
    expect(ring.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(4000); // attempt 3 works
    expect(ring.status).toBe('connected');
    expect(fake.connectCalls).toBe(4);
    expect(statuses.slice(-2)).toEqual(['reconnecting', 'connected']);

    const got: LivePacket[] = [];
    ring.onPacket((p) => got.push(p));
    fake.live.notify(encodeLivePacket(packet));
    expect(got).toHaveLength(1); // one listener only, even after reconnecting
  });

  it('stops the ring and does not reconnect after the user disconnects', async () => {
    vi.useFakeTimers();
    const fake = new FakeRing();
    const ring = new BluetoothRing(api(fake));
    await ring.connect();
    await ring.disconnect();
    expect(fake.command.writes.at(-1)).toEqual([RingCommand.STOP]);
    fake.drop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ring.status).toBe('disconnected');
    expect(fake.connectCalls).toBe(1);
  });

  it('explains why it could not connect', async () => {
    const notFound = Object.assign(new Error('cancelled'), { name: 'NotFoundError' });
    const denied = Object.assign(new Error('denied'), { name: 'SecurityError' });
    await expect(new BluetoothRing(undefined).connect()).rejects.toMatchObject({ key: 'err.bleUnavailable' });
    await expect(new BluetoothRing(api(notFound)).connect()).rejects.toMatchObject({ key: 'err.ringNotFound' });
    await expect(new BluetoothRing(api(denied)).connect()).rejects.toMatchObject({ key: 'err.blePermission' });
    const off = { ...api(new FakeRing()), getAvailability: async () => false };
    await expect(new BluetoothRing(off).connect()).rejects.toBeInstanceOf(RingError);

    const broken = new FakeRing();
    broken.failConnects = 1;
    const ring = new BluetoothRing(api(broken));
    await expect(ring.connect()).rejects.toMatchObject({ key: 'err.ringConnect' });
    expect(ring.status).toBe('disconnected');
  });
});
