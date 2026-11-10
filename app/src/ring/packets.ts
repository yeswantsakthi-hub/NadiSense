import { LIVE_PACKET_BYTES, RingCommand, TEMP_NONE } from './contract';

/** One decoded live packet. Values the ring marks as "no reading" become null. */
export interface LivePacket {
  /** Ring clock, ms since boot. */
  timestampMs: number;
  hrBpm: number | null;
  spo2Pct: number | null;
  confidence: number;
  fingerStatus: number;
  skinTempC: number | null;
  /** Interval ending at the latest beat; null when this packet carries no new beat. */
  rrMs: number | null;
  motion: boolean;
  batteryPct: number;
  beatSeq: number;
}

export class PacketError extends Error {}

type Bytes = DataView | ArrayBufferLike | Uint8Array;

function toView(data: Bytes): DataView {
  if (data instanceof DataView) return data;
  if (ArrayBuffer.isView(data)) return new DataView(data.buffer, data.byteOffset, data.byteLength);
  return new DataView(data);
}

/** Decodes the 16-byte live packet. Throws PacketError on the wrong length. */
export function parseLivePacket(data: Bytes): LivePacket {
  const v = toView(data);
  if (v.byteLength !== LIVE_PACKET_BYTES) {
    throw new PacketError(`live packet must be ${LIVE_PACKET_BYTES} bytes, got ${v.byteLength}`);
  }
  const hr = v.getUint8(4);
  const spo2 = v.getUint8(5);
  const temp = v.getInt16(8, true);
  const rr = v.getUint16(10, true);
  return {
    timestampMs: v.getUint32(0, true),
    hrBpm: hr === 0 ? null : hr,
    spo2Pct: spo2 === 0 ? null : spo2,
    confidence: Math.min(100, v.getUint8(6)),
    fingerStatus: v.getUint8(7),
    skinTempC: temp === TEMP_NONE ? null : temp / 100,
    rrMs: rr === 0 ? null : rr,
    motion: v.getUint8(12) === 1,
    batteryPct: Math.min(100, v.getUint8(13)),
    beatSeq: v.getUint16(14, true),
  };
}

/** Inverse of parseLivePacket: used by the simulator so it goes through the same parser as the ring. */
export function encodeLivePacket(p: LivePacket): Uint8Array {
  const bytes = new Uint8Array(LIVE_PACKET_BYTES);
  const v = new DataView(bytes.buffer);
  const u8 = (n: number | null) => Math.max(0, Math.min(255, Math.round(n ?? 0)));
  v.setUint32(0, p.timestampMs >>> 0, true);
  v.setUint8(4, u8(p.hrBpm));
  v.setUint8(5, u8(p.spo2Pct));
  v.setUint8(6, u8(p.confidence));
  v.setUint8(7, u8(p.fingerStatus));
  v.setInt16(
    8,
    p.skinTempC === null ? TEMP_NONE : Math.max(-32767, Math.min(32767, Math.round(p.skinTempC * 100))),
    true,
  );
  v.setUint16(10, p.rrMs === null ? 0 : Math.max(1, Math.min(65535, Math.round(p.rrMs))), true);
  v.setUint8(12, p.motion ? 1 : 0);
  v.setUint8(13, u8(p.batteryPct));
  v.setUint16(14, p.beatSeq & 0xffff, true);
  return bytes;
}

export function startCommand(): Uint8Array {
  return Uint8Array.of(RingCommand.START);
}

export function stopCommand(): Uint8Array {
  return Uint8Array.of(RingCommand.STOP);
}

/** 0x03 + uint32 LE Unix seconds. */
export function setTimeCommand(unixMs: number): Uint8Array {
  const bytes = new Uint8Array(5);
  bytes[0] = RingCommand.SET_TIME;
  new DataView(bytes.buffer).setUint32(1, Math.floor(unixMs / 1000) >>> 0, true);
  return bytes;
}

/** Beats between two beat_seq values, allowing for the 16-bit wrap. */
export function beatsBetween(prevSeq: number, seq: number): number {
  return (seq - prevSeq + 0x10000) & 0xffff;
}
