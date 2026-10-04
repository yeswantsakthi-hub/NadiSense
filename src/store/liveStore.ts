import { create } from 'zustand';
import { ECG_RATE_HZ, IMU_RATE_HZ, PPG_RATE_HZ, type TempSample } from '../data/SensorSource';
import { RingBuffer } from '../lib/RingBuffer';

export type StreamId = 'ppg' | 'imu' | 'temp' | 'ecg';
export type EventLevel = 'live' | 'info' | 'motion' | 'alert';
export type EventSource = 'SYSTEM' | 'PPG' | 'IMU' | 'ECG' | 'TEMP';

export interface LogEvent {
  id: number;
  /** Wall-clock ms. */
  at: number;
  source: EventSource;
  level: EventLevel;
  text: string;
}

/** Time range on the ring clock (ms); `to` is null while the movement is still going on. */
export interface Segment {
  from: number;
  to: number | null;
}

interface LiveState {
  connectedAt: number | null;
  events: LogEvent[];
  moving: boolean;
  movingSince: number | null;
  motionSegments: Segment[];
  streams: Record<StreamId, boolean>;
  temp: TempSample | null;
  battery: number | null;
  log(source: EventSource, level: EventLevel, text: string): void;
  reset(): void;
}

const MAX_EVENTS = 60;
const IDLE_STREAMS: Record<StreamId, boolean> = { ppg: false, imu: false, temp: false, ecg: false };
let nextId = 1;

export const useLiveStore = create<LiveState>((set) => ({
  connectedAt: null,
  events: [],
  moving: false,
  movingSince: null,
  motionSegments: [],
  streams: IDLE_STREAMS,
  temp: null,
  battery: null,

  log(source, level, text) {
    const event = { id: nextId++, at: Date.now(), source, level, text };
    set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) }));
  },

  reset() {
    set({
      connectedAt: Date.now(),
      moving: false,
      movingSince: null,
      motionSegments: [],
      streams: IDLE_STREAMS,
      temp: null,
      battery: null,
    });
  },
}));

/** High-rate display buffers live outside React state; the canvas reads them every frame. */
export const ppgBuffer = new RingBuffer(PPG_RATE_HZ * 8);
/** Acceleration magnitude in g. */
export const imuBuffer = new RingBuffer(IMU_RATE_HZ * 8);
export const ecgBuffer = new RingBuffer(ECG_RATE_HZ * 8);

export const STREAM_INFO: Record<StreamId, { name: string; detail: string }> = {
  ppg: { name: 'PPG', detail: `red + infrared · ${PPG_RATE_HZ} Hz` },
  imu: { name: 'IMU', detail: `accelerometer · ${IMU_RATE_HZ} Hz` },
  temp: { name: 'TEMP', detail: 'skin · once a minute' },
  ecg: { name: 'ECG', detail: `on demand · ${ECG_RATE_HZ} Hz` },
};
