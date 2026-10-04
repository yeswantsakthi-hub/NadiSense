# NadiSense Companion App

## What this is
NadiSense is a smart ring (Vishwakarma Awards 2026-27, Frontier Diagnostics theme) that turns
Nadi Pariksha (traditional pulse diagnosis) into continuous health screening. This repo is the
companion app. It receives sensor data from the ring over Bluetooth Low Energy (BLE), runs the
signal-processing algorithms, and shows vitals, risk flags, and Nadi pulse insights.

Deadline: Stage 2 submission on 24 Oct 2026. Hardware arrives during week 1, so the app must
work end to end with **mock data first** and switch to real BLE data with no UI changes.

## Tech stack
- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS
- Recharts for trends; a custom `<canvas>` component for live waveforms (Recharts is too slow at 400 Hz)
- Web Bluetooth API for BLE (works in Chrome on Android, Windows, macOS; not iOS)
- Dexie (IndexedDB) for local storage of sessions and history
- vite-plugin-pwa so it installs on a phone like an app
- jsPDF for the clinician report
- Vitest for unit tests

## Architecture

```
src/
  data/
    SensorSource.ts      # interface every data source implements
    MockSource.ts        # synthetic PPG, ECG, temp, IMU with realistic shapes and noise
    BleSource.ts         # Web Bluetooth implementation of the same interface
    packets.ts           # binary packet parsing (see BLE contract)
  dsp/                   # pure functions only, no React, fully unit tested
    filters.ts           # band-pass (PPG 0.5–8 Hz, ECG 0.5–40 Hz), moving average
    peaks.ts             # PPG systolic peak + foot detection, ECG R-peak detection
    vitals.ts            # HR, HRV (RMSSD, LF/HF), SpO2 (ratio of ratios), respiratory rate
    rhythm.ts            # irregular-rhythm (AFib-type) flag from beat intervals
    ptt.ts               # pulse transit time (ECG R-peak to PPG foot) and BP trend
    sleep.ts             # sleep detection from IMU + HRV; apnea risk from SpO2 dips
    nadi.ts              # pulse morphology metrics (see below)
    baseline.ts          # personal rolling baseline + deviation alerts
    motion.ts            # flag PPG segments corrupted by motion (IMU)
  store/                 # Dexie DB + Zustand state
  screens/
    Connect.tsx          # pair ring, or "Use demo data"
    Dashboard.tsx        # live waveform + today's vitals + baseline status
    EcgCheck.tsx         # guided 30 s ECG recording + rhythm result + BP trend
    NadiInsights.tsx     # pulse shape, morphology metrics, risk flags
    History.tsx          # 7/30-day trends
    Report.tsx           # weekly clinician PDF
    Settings.tsx         # BP cuff calibration entry, units, data export/delete
  components/
    WaveformCanvas.tsx   # scrolling real-time waveform
```

The UI only talks to `SensorSource`. A toggle in Settings and on the Connect screen switches
between `MockSource` and `BleSource`.

```ts
interface SensorSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onPpg(cb: (s: { t: number; red: number; ir: number }[]) => void): void;
  onEcg(cb: (s: { t: number; v: number }[]) => void): void;
  onTemp(cb: (s: { t: number; celsius: number }) => void): void;
  onImu(cb: (s: { t: number; ax: number; ay: number; az: number }[]) => void): void;
  startEcgSession(seconds: number): Promise<void>;
  battery(): Promise<number>;
}
```

(Implementation note: the `on*` methods return an unsubscribe function so React effects can clean up.
Callers that ignore the return value still match the shape above.)

## BLE contract (firmware must match this)
MCU: Seeed XIAO nRF52840 Sense. All values little-endian. `t0` is milliseconds since boot,
taken from the single MCU clock shared by ECG and PPG (required for pulse transit time).

| Characteristic | UUID (replace with generated UUIDs) | Props | Payload |
|---|---|---|---|
| Service | `NADI-SERVICE-UUID` | — | — |
| PPG | `NADI-PPG-UUID` | notify | `uint32 t0, uint16 n, n × (uint32 red, uint32 ir)` at 400 Hz |
| ECG | `NADI-ECG-UUID` | notify | `uint32 t0, uint16 n, n × int16 v` at 250 Hz |
| Temp | `NADI-TEMP-UUID` | notify, read | `uint32 t0, int16 centiCelsius` once per minute |
| IMU | `NADI-IMU-UUID` | notify | `uint32 t0, uint16 n, n × (int16 ax, ay, az)` at 50 Hz |
| Control | `NADI-CTRL-UUID` | write | `0x01` start ECG session (+uint8 seconds), `0x02` high-rate mode, `0x03` low-rate mode |
| Battery | standard `0x180F` / `0x2A19` | read, notify | uint8 percent |

Sample timestamps are `t0 + i × (1000 / rate)`.

## Nadi pulse-morphology metrics (`dsp/nadi.ts`)
Computed per beat from the IR PPG, then averaged over clean beats in a window.

| Metric | Definition | Related pulse quality |
|---|---|---|
| Rise time | foot → systolic peak (ms) | speed of movement (gati) |
| Pulse amplitude | normalised systolic height | strength (bala) |
| Augmentation index | reflected peak ÷ systolic peak (%) | arterial stiffness |
| Dicrotic notch prominence | notch depth relative to amplitude | vascular tone |
| Stiffness index | height ÷ time between systolic and diastolic peaks | vascular ageing |
| Regularity score | 0–100 from beat interval and shape variability | rhythm |

Use the second derivative of the PPG to locate the notch and diastolic peak.

## Mock data requirements (`MockSource.ts`)
- PPG: sum of two Gaussians per beat (systolic + reflected wave) with a dicrotic notch,
  HR drifting 60–80 bpm, respiratory modulation (~14/min), small noise, occasional motion bursts.
- ECG: synthetic P-QRS-T complex aligned to the PPG beats with a realistic 200–250 ms delay
  to the PPG foot.
- Scenario switch: `normal`, `irregular` (random beat intervals), `apnea-night` (periodic SpO2 dips).
- Temperature around 36.4–36.8 °C; IMU mostly still with occasional movement.

## Product rules
- Every risk output is a **screening flag, not a diagnosis**. Wording: "Low / Moderate / Elevated
  risk" plus "Consider consulting a doctor" when elevated. Never say "you have".
- BP is shown only as a **trend relative to the user's calibration**, never an absolute reading,
  until the user enters a cuff reading in Settings.
- Show a data-quality indicator; do not compute metrics on segments flagged by `motion.ts`.
- All data stays on the device. Settings has "Export my data" and "Delete all data".

## Design direction
A dark **instrument console** (mission-control monitoring look) with an Indian, Ayurvedic warmth.
Avoid generic health-app styling (blue gradients, big rounded cards, pastel fills).
- Dark only. Tokens live in `src/index.css`: bg `#05080F`, panels `#0C1220` with hairline
  borders `#1D273D`, 3 px corners. Text `#E6EAF0`, muted `#8892A6`.
- Small uppercase **khaki labels** (`.label`, `#B3A374`) head every panel.
- Signal teal `#2DBE9F` (waveforms, live, primary), turmeric `#E0A31A` (Nadi accent only),
  amber `#F2A23A` (movement / data-quality flags), alert `#F0524A` (elevated risk only),
  select blue `#5B8DEF` (focus).
- Console building blocks in `src/components/`: `StatusBanner` (one big status word + what to do
  + key figures), `Panel` + `Tag`, `VitalCard`, `EventLog`, `SessionPanel`.
- Type: Figtree for UI; IBM Plex Mono with tabular numerals for vitals, timestamps and figures.
- The live pulse waveform is the signature element: large, edge to edge on phones.
  Motion-flagged stretches are shaded amber and excluded from scaling.
- Mobile first (≈390 px, waveform above the fold); on desktop (≥1024 px) a two-column console
  with event log and session panels on the right. Visible focus states, respects reduced motion.

## Build phases
1. **Scaffold + mock data:** Vite app, routing, `SensorSource`, `MockSource`, live `WaveformCanvas`
   on the Dashboard.
2. **DSP core with tests:** filters, peaks, HR, HRV, SpO2, respiratory rate. Unit tests use
   MockSource signals with known HR/RR.
3. **Screens:** Dashboard, ECG Check, Nadi Insights with real computed values from mock data.
4. **Advanced DSP:** rhythm flag, PTT/BP trend, sleep/apnea, baseline, Nadi metrics.
5. **BLE:** `BleSource` + `packets.ts` against the contract above; test with the real ring.
6. **History, report PDF, PWA install, polish.**

## Working rules for Claude Code
- Keep `dsp/` free of React and side effects; every function gets a Vitest test.
- After each phase: run `npm run build` and `npm test`, fix all errors, then summarise what changed.
- Do not add libraries beyond the stack above without asking.
- Commit after each phase with a clear message.
