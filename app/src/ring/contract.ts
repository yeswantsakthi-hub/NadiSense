/**
 * NadiSense ring v1 ⇄ app Bluetooth contract. The ring firmware must match this file exactly.
 * Hardware: Seeed XIAO nRF52840 Sense + MAX30101/MAX32664 + TMP117 + on-board IMU.
 */

export const RING_DEVICE_NAME = 'NadiSense';

export const RING_SERVICE_UUID = '4e534e00-0000-4000-8000-00000000a001';
/** Notify. One 16-byte live packet on every detected beat, and at least once a second. */
export const RING_LIVE_UUID = '4e534e00-0000-4000-8000-00000000a002';
/** Write (with or without response). See RingCommand. */
export const RING_COMMAND_UUID = '4e534e00-0000-4000-8000-00000000a003';

export const RingCommand = {
  START: 0x01,
  STOP: 0x02,
  /** Followed by uint32 little-endian Unix time in seconds. */
  SET_TIME: 0x03,
} as const;

/**
 * Live packet, 16 bytes, little-endian:
 *
 * | offset | type   | field            | notes                                               |
 * |--------|--------|------------------|-----------------------------------------------------|
 * | 0      | uint32 | timestamp_ms     | ms since ring boot (wraps after ~49 days)           |
 * | 4      | uint8  | hr_bpm           | 0 = no reading                                      |
 * | 5      | uint8  | spo2_pct         | 0 = no reading                                      |
 * | 6      | uint8  | confidence       | 0–100, from the MAX32664                            |
 * | 7      | uint8  | finger_status    | 3 = finger on; anything else = not on the finger    |
 * | 8      | int16  | skin_temp_c_x100 | °C × 100; -32768 = no reading                       |
 * | 10     | uint16 | rr_interval_ms   | interval ending at the latest beat; 0 = no new beat |
 * | 12     | uint8  | motion_flag      | 1 = moving                                          |
 * | 13     | uint8  | battery_pct      | 0–100                                               |
 * | 14     | uint16 | beat_seq         | +1 per detected beat (wraps at 65535); was "reserved" |
 */
export const LIVE_PACKET_BYTES = 16;

export const FINGER_ON = 3;
/** Minimum MAX32664 confidence before heart rate and SpO₂ are shown. */
export const MIN_CONFIDENCE = 80;
export const TEMP_NONE = -32768;

/** The ring is considered silent if no packet arrives for this long. */
export const LINK_TIMEOUT_MS = 4000;
