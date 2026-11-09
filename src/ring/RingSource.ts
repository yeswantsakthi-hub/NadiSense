import { parseLivePacket, type LivePacket } from './packets';

export type Unsubscribe = () => void;
export type LinkStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type SourceKind = 'ring' | 'sim';
export type PacketListener = (packet: LivePacket, receivedAt: number) => void;

/** What the app talks to. The real ring and the simulator both implement it. */
export interface RingSource {
  readonly kind: SourceKind;
  readonly status: LinkStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onPacket(cb: PacketListener): Unsubscribe;
  onStatus(cb: (status: LinkStatus) => void): Unsubscribe;
}

/**
 * Base for every source. Subclasses only hand over raw bytes; parsing happens here, once,
 * so the simulator and the ring share a single data path.
 */
export abstract class PacketSource implements RingSource {
  abstract readonly kind: SourceKind;
  private currentStatus: LinkStatus = 'disconnected';
  private readonly packetListeners = new Set<PacketListener>();
  private readonly statusListeners = new Set<(s: LinkStatus) => void>();
  /** Packets dropped because they could not be parsed. */
  badPackets = 0;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  get status(): LinkStatus {
    return this.currentStatus;
  }

  onPacket(cb: PacketListener): Unsubscribe {
    this.packetListeners.add(cb);
    return () => {
      this.packetListeners.delete(cb);
    };
  }

  onStatus(cb: (status: LinkStatus) => void): Unsubscribe {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  protected setStatus(status: LinkStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  /** Raw bytes from the link (or the simulator) → parsed packet → listeners. */
  protected receive(data: Parameters<typeof parseLivePacket>[0], receivedAt = Date.now()): void {
    let packet: LivePacket;
    try {
      packet = parseLivePacket(data);
    } catch {
      this.badPackets += 1;
      return;
    }
    this.packetListeners.forEach((cb) => cb(packet, receivedAt));
  }
}
