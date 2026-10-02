import type { SensorSource, Unsubscribe } from './SensorSource';

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

const noop: Unsubscribe = () => {};

/**
 * Placeholder until phase 5, when this implements the BLE contract in CLAUDE.md
 * (with packets.ts). It already satisfies SensorSource so the UI toggle works.
 */
export class BleSource implements SensorSource {
  async connect(): Promise<void> {
    throw new Error(
      isWebBluetoothAvailable()
        ? 'Ring pairing is not built yet. Use demo data for now.'
        : 'This browser cannot use Bluetooth. Use Chrome on Android, Windows or macOS.',
    );
  }

  async disconnect(): Promise<void> {}

  onPpg(): Unsubscribe {
    return noop;
  }

  onEcg(): Unsubscribe {
    return noop;
  }

  onTemp(): Unsubscribe {
    return noop;
  }

  onImu(): Unsubscribe {
    return noop;
  }

  async startEcgSession(): Promise<void> {
    throw new Error('Not connected');
  }

  async battery(): Promise<number> {
    throw new Error('Not connected');
  }
}
