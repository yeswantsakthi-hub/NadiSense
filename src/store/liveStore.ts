import { create } from 'zustand';
import type { MessageKey, Vars } from '../i18n';
import type { LoggedPacket } from '../ring/diagnostics';
import type { LivePacket } from '../ring/packets';

export type EventLevel = 'live' | 'info' | 'motion' | 'alert';
export type EventSource = 'SYSTEM' | 'RING';

export interface LogEvent {
  id: number;
  /** Wall-clock ms. */
  at: number;
  source: EventSource;
  level: EventLevel;
  /** Stored untranslated so the log follows the current language. */
  key: MessageKey;
  vars?: Vars;
}

interface LiveState {
  connectedAt: number | null;
  events: LogEvent[];
  /** Most recent packet from the ring (or simulator), and when it arrived (wall clock). */
  latest: LivePacket | null;
  lastPacketAt: number | null;
  packets: number;
  log(source: EventSource, level: EventLevel, key: MessageKey, vars?: Vars): void;
  reset(): void;
}

const MAX_EVENTS = 60;
let nextId = 1;

export const useLiveStore = create<LiveState>((set) => ({
  connectedAt: null,
  events: [],
  latest: null,
  lastPacketAt: null,
  packets: 0,

  log(source, level, key, vars) {
    const event = { id: nextId++, at: Date.now(), source, level, key, vars };
    set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) }));
  },

  reset() {
    beatLog.length = 0;
    packetLog.length = 0;
    set({ connectedAt: Date.now(), latest: null, lastPacketAt: null, packets: 0 });
  },
}));

/** One detected beat. Kept outside React state; the beat strip reads it every frame. */
export interface BeatRecord {
  /** Wall-clock ms when the packet arrived. */
  at: number;
  rrMs: number;
  beatSeq: number;
  motion: boolean;
}

/** Beats from the last few minutes, oldest first (enough for a 2-minute rhythm window). */
export const beatLog: BeatRecord[] = [];
const BEAT_HISTORY_MS = 3 * 60_000;

export function addBeat(beat: BeatRecord): void {
  beatLog.push(beat);
  const cutoff = beat.at - BEAT_HISTORY_MS;
  let drop = 0;
  while (drop < beatLog.length && beatLog[drop]!.at < cutoff) drop++;
  if (drop) beatLog.splice(0, drop);
}

/** Every packet from the last few minutes, oldest first, for the ring diagnostics screen. */
export const packetLog: LoggedPacket[] = [];
const PACKET_HISTORY_MS = 10 * 60_000;

export function addPacket(entry: LoggedPacket): void {
  packetLog.push(entry);
  const cutoff = entry.at - PACKET_HISTORY_MS;
  let drop = 0;
  while (drop < packetLog.length && packetLog[drop]!.at < cutoff) drop++;
  if (drop) packetLog.splice(0, drop);
}
