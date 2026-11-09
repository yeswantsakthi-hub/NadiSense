/**
 * The small part of the Web Bluetooth API the app uses. TypeScript's DOM types don't include it,
 * and keeping it as interfaces lets tests pass in a fake ring.
 */

export interface GattCharacteristic extends EventTarget {
  readonly value?: DataView | null;
  startNotifications(): Promise<GattCharacteristic>;
  writeValue(value: Uint8Array): Promise<void>;
  writeValueWithResponse?(value: Uint8Array): Promise<void>;
}

export interface GattService {
  getCharacteristic(uuid: string): Promise<GattCharacteristic>;
}

export interface GattServer {
  readonly connected: boolean;
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<GattService>;
}

export interface BleDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: GattServer;
}

export interface RequestDeviceOptions {
  filters: ({ name: string } | { services: string[] })[];
  optionalServices?: string[];
}

export interface BluetoothApi {
  requestDevice(options: RequestDeviceOptions): Promise<BleDevice>;
  getAvailability?(): Promise<boolean>;
  /** Devices this site was already allowed to use (not available in every Chrome version). */
  getDevices?(): Promise<BleDevice[]>;
}

export function browserBluetooth(): BluetoothApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth;
}
