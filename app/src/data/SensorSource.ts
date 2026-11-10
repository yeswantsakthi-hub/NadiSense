/**
 * Raw sample types and rates used by the simulator's signal model (mockModel.ts).
 * The app itself receives processed 16-byte live packets; see src/ring/contract.ts.
 */
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

export interface ImuSample {
  t: number;
  /** Acceleration in g. */
  ax: number;
  ay: number;
  az: number;
}

export const PPG_RATE_HZ = 400;
export const ECG_RATE_HZ = 250;
export const IMU_RATE_HZ = 50;
