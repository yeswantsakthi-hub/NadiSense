import { describe, expect, it } from 'vitest';
import { LIVE_PACKET_BYTES, RingCommand } from './contract';
import {
  PacketError,
  beatsBetween,
  encodeLivePacket,
  parseLivePacket,
  setTimeCommand,
  startCommand,
  stopCommand,
  type LivePacket,
} from './packets';

/** A packet written byte by byte, exactly as the firmware would send it. */
function handMadePacket(): Uint8Array {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 123_456_789, true); // timestamp_ms
  b[4] = 72; // hr
  b[5] = 98; // spo2
  b[6] = 95; // confidence
  b[7] = 3; // finger on
  v.setInt16(8, 3412, true); // 34.12 °C
  v.setUint16(10, 833, true); // rr
  b[12] = 0; // still
  b[13] = 87; // battery
  v.setUint16(14, 4242, true); // beat_seq
  return b;
}

const sample: LivePacket = {
  timestampMs: 123_456_789,
  hrBpm: 72,
  spo2Pct: 98,
  confidence: 95,
  fingerStatus: 3,
  skinTempC: 34.12,
  rrMs: 833,
  motion: false,
  batteryPct: 87,
  beatSeq: 4242,
};

describe('parseLivePacket', () => {
  it('decodes every field of a firmware packet (little-endian)', () => {
    expect(parseLivePacket(handMadePacket())).toEqual(sample);
  });

  it('accepts DataView, ArrayBuffer and a Uint8Array slice of a larger buffer', () => {
    const bytes = handMadePacket();
    expect(parseLivePacket(new DataView(bytes.buffer))).toEqual(sample);
    expect(parseLivePacket(bytes.buffer)).toEqual(sample);
    const padded = new Uint8Array(20);
    padded.set(bytes, 4);
    expect(parseLivePacket(padded.subarray(4, 20))).toEqual(sample);
  });

  it('turns "no reading" values into null', () => {
    const b = handMadePacket();
    const v = new DataView(b.buffer);
    b[4] = 0;
    b[5] = 0;
    v.setInt16(8, -32768, true);
    v.setUint16(10, 0, true);
    const p = parseLivePacket(b);
    expect([p.hrBpm, p.spo2Pct, p.skinTempC, p.rrMs]).toEqual([null, null, null, null]);
  });

  it('reads negative temperatures, the motion flag and large unsigned values', () => {
    const b = handMadePacket();
    const v = new DataView(b.buffer);
    v.setInt16(8, -250, true);
    b[12] = 1;
    v.setUint32(0, 0xffffffff, true);
    v.setUint16(14, 65535, true);
    const p = parseLivePacket(b);
    expect(p.skinTempC).toBe(-2.5);
    expect(p.motion).toBe(true);
    expect(p.timestampMs).toBe(4294967295);
    expect(p.beatSeq).toBe(65535);
  });

  it('clamps out-of-range percentages', () => {
    const b = handMadePacket();
    b[6] = 250;
    b[13] = 200;
    const p = parseLivePacket(b);
    expect(p.confidence).toBe(100);
    expect(p.batteryPct).toBe(100);
  });

  it('rejects packets of the wrong size', () => {
    expect(() => parseLivePacket(new Uint8Array(15))).toThrow(PacketError);
    expect(() => parseLivePacket(new Uint8Array(17))).toThrow(PacketError);
  });
});

describe('encodeLivePacket', () => {
  it('produces exactly the firmware bytes and round-trips', () => {
    const encoded = encodeLivePacket(sample);
    expect(encoded.byteLength).toBe(LIVE_PACKET_BYTES);
    expect([...encoded]).toEqual([...handMadePacket()]);
    expect(parseLivePacket(encoded)).toEqual(sample);
  });

  it('round-trips the "no reading" values', () => {
    const empty: LivePacket = { ...sample, hrBpm: null, spo2Pct: null, skinTempC: null, rrMs: null };
    expect(parseLivePacket(encodeLivePacket(empty))).toEqual(empty);
  });
});

describe('commands', () => {
  it('encodes start, stop and set-time', () => {
    expect([...startCommand()]).toEqual([RingCommand.START]);
    expect([...stopCommand()]).toEqual([RingCommand.STOP]);
    // 2026-11-09T00:00:00Z = 1794182400 s = 0x6AF10D00, little-endian; milliseconds are dropped
    expect([...setTimeCommand(1_794_182_400_123)]).toEqual([0x03, 0x00, 0x0d, 0xf1, 0x6a]);
  });
});

describe('beatsBetween', () => {
  it('counts beats across the 16-bit wrap', () => {
    expect(beatsBetween(10, 11)).toBe(1);
    expect(beatsBetween(10, 13)).toBe(3);
    expect(beatsBetween(65535, 0)).toBe(1);
    expect(beatsBetween(65534, 2)).toBe(4);
    expect(beatsBetween(7, 7)).toBe(0);
  });
});

describe('FIRMWARE.md test vector', () => {
  it('decodes the documented bytes', () => {
    const hex = '15 cd 5b 07 48 62 5f 03 54 0d 41 03 00 57 92 10';
    const bytes = Uint8Array.from(hex.split(' ').map((h) => parseInt(h, 16)));
    expect(parseLivePacket(bytes)).toEqual({
      timestampMs: 123456789,
      hrBpm: 72,
      spo2Pct: 98,
      confidence: 95,
      fingerStatus: 3,
      skinTempC: 34.12,
      rrMs: 833,
      motion: false,
      batteryPct: 87,
      beatSeq: 4242,
    });
  });
});
