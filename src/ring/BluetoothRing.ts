import { RING_COMMAND_UUID, RING_DEVICE_NAME, RING_LIVE_UUID, RING_SERVICE_UUID } from './contract';
import { setTimeCommand, startCommand, stopCommand } from './packets';
import { PacketSource } from './RingSource';
import { browserBluetooth, type BleDevice, type BluetoothApi, type GattCharacteristic } from './webBluetooth';

/** Error messages are i18n keys; the UI translates them. */
export type RingErrorKey =
  | 'err.bleUnavailable'
  | 'err.bluetoothOff'
  | 'err.ringNotFound'
  | 'err.blePermission'
  | 'err.ringConnect';

export class RingError extends Error {
  constructor(readonly key: RingErrorKey) {
    super(key);
  }
}

const MAX_BACKOFF_MS = 15_000;

/**
 * The real NadiSense ring over Web Bluetooth (Chrome on Android, Windows, macOS).
 * Connects, syncs the ring's clock, starts streaming, and reconnects on its own after a drop.
 */
export class BluetoothRing extends PacketSource {
  readonly kind = 'ring' as const;
  private device: BleDevice | null = null;
  private live: GattCharacteristic | null = null;
  private command: GattCharacteristic | null = null;
  private closedByUser = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly bt: BluetoothApi | undefined = browserBluetooth()) {
    super();
  }

  get deviceName(): string | null {
    return this.device?.name ?? null;
  }

  /** Opens Chrome's device chooser (needs a user tap), then connects. */
  async connect(): Promise<void> {
    if (!this.bt) throw new RingError('err.bleUnavailable');
    if (this.bt.getAvailability && !(await this.bt.getAvailability().catch(() => true))) {
      throw new RingError('err.bluetoothOff');
    }
    this.setStatus('connecting');
    let device: BleDevice;
    try {
      device = await this.bt.requestDevice({
        filters: [{ name: RING_DEVICE_NAME }, { services: [RING_SERVICE_UUID] }],
        optionalServices: [RING_SERVICE_UUID],
      });
    } catch (e) {
      this.setStatus('disconnected');
      const name = e instanceof Error ? e.name : '';
      throw new RingError(name === 'SecurityError' || name === 'NotAllowedError' ? 'err.blePermission' : 'err.ringNotFound');
    }
    await this.attach(device);
  }

  /** Reconnects to a ring this site already paired with, without the chooser, if Chrome allows it. */
  async restore(): Promise<boolean> {
    const known = (await this.bt?.getDevices?.().catch(() => [])) ?? [];
    const ring = known.find((d) => d.name === RING_DEVICE_NAME) ?? known[0];
    if (!ring) return false;
    this.setStatus('connecting');
    try {
      await this.attach(ring);
      return true;
    } catch {
      this.setStatus('disconnected');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.command && this.device?.gatt?.connected) await this.write(stopCommand()).catch(() => {});
    this.device?.removeEventListener('gattserverdisconnected', this.onDrop);
    this.live?.removeEventListener('characteristicvaluechanged', this.onValue);
    this.device?.gatt?.disconnect();
    this.setStatus('disconnected');
  }

  private async attach(device: BleDevice): Promise<void> {
    this.closedByUser = false;
    this.device?.removeEventListener('gattserverdisconnected', this.onDrop);
    this.device = device;
    device.addEventListener('gattserverdisconnected', this.onDrop);
    try {
      await this.openGatt();
    } catch {
      this.device.gatt?.disconnect();
      this.setStatus('disconnected');
      throw new RingError('err.ringConnect');
    }
  }

  private async openGatt(): Promise<void> {
    const gatt = this.device?.gatt;
    if (!gatt) throw new Error('no GATT server');
    const server = await gatt.connect();
    const service = await server.getPrimaryService(RING_SERVICE_UUID);
    const live = await service.getCharacteristic(RING_LIVE_UUID);
    this.command = await service.getCharacteristic(RING_COMMAND_UUID);
    // Chrome can hand back the same object after a reconnect; never listen twice.
    this.live?.removeEventListener('characteristicvaluechanged', this.onValue);
    this.live = live;
    live.addEventListener('characteristicvaluechanged', this.onValue);
    await live.startNotifications();
    await this.write(setTimeCommand(Date.now()));
    await this.write(startCommand());
    this.attempt = 0;
    this.setStatus('connected');
  }

  private write(bytes: Uint8Array): Promise<void> {
    const c = this.command;
    if (!c) return Promise.reject(new Error('not connected'));
    return c.writeValueWithResponse ? c.writeValueWithResponse(bytes) : c.writeValue(bytes);
  }

  private readonly onValue = (event: Event): void => {
    const value = (event.target as GattCharacteristic | null)?.value;
    if (value) this.receive(value);
  };

  private readonly onDrop = (): void => {
    if (this.closedByUser) return;
    this.setStatus('reconnecting');
    this.scheduleRetry();
  };

  /** 1 s, 2 s, 4 s … up to 15 s between attempts, until it works or the user disconnects. */
  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt);
    this.attempt += 1;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (this.closedByUser) return;
      try {
        await this.openGatt();
      } catch {
        if (!this.closedByUser) this.scheduleRetry();
      }
    }, delay);
  }
}
