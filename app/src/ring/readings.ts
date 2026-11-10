import { FINGER_ON, LINK_TIMEOUT_MS, MIN_CONFIDENCE } from './contract';
import type { LivePacket } from './packets';

/**
 * Whether a live reading may be shown.
 * - no-data: nothing from the ring recently
 * - place:   ring not on the finger            → "Place ring"
 * - hold:    on the finger but low confidence or moving → "Hold still…"
 * - ok:      finger on, confidence ≥ 80, still → show heart rate and SpO₂
 */
export type ReadingState = 'no-data' | 'place' | 'hold' | 'ok';

export function readingState(packet: LivePacket | null, receivedAt: number | null, now: number): ReadingState {
  if (!packet || receivedAt === null || now - receivedAt > LINK_TIMEOUT_MS) return 'no-data';
  if (packet.fingerStatus !== FINGER_ON) return 'place';
  if (packet.confidence < MIN_CONFIDENCE || packet.motion) return 'hold';
  return 'ok';
}

/** Heart rate and SpO₂ to display, or null when the reading must not be shown. */
export function shownVitals(
  packet: LivePacket | null,
  receivedAt: number | null,
  now: number,
): { hrBpm: number | null; spo2Pct: number | null } {
  if (readingState(packet, receivedAt, now) !== 'ok' || !packet) return { hrBpm: null, spo2Pct: null };
  return { hrBpm: packet.hrBpm, spo2Pct: packet.spo2Pct };
}
