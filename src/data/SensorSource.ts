/** All timestamps `t` are milliseconds on the ring's single MCU clock (shared by ECG and PPG). */
export interface PpgSample {
  t: number;
  red: number;
  ir: number;
}

export interface EcgSample {
  t: number;
  /** Millivolts. */
  v: number;
}

export interface TempSample {
  t: number;
  celsius: number;
}

export interface ImuSample {
  t: number;
  /** Acceleration in g. */
  ax: number;
  ay: number;
  az: number;
}

export type Unsubscribe = () => void;

/**
 * The only thing the UI talks to. MockSource and BleSource both implement it,
 * so switching between demo data and the real ring needs no UI changes.
 */
export interface SensorSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onPpg(cb: (s: PpgSample[]) => void): Unsubscribe;
  onEcg(cb: (s: EcgSample[]) => void): Unsubscribe;
  /** Delivers the most recent reading straight away if one exists, then one per minute. */
  onTemp(cb: (s: TempSample) => void): Unsubscribe;
  onImu(cb: (s: ImuSample[]) => void): Unsubscribe;
  /** Starts ECG streaming; resolves when the recording window has ended. */
  startEcgSession(seconds: number): Promise<void>;
  battery(): Promise<number>;
}

export const PPG_RATE_HZ = 400;
export const ECG_RATE_HZ = 250;
export const IMU_RATE_HZ = 50;
