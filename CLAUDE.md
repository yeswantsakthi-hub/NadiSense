# NadiSense Companion App

## What this is
NadiSense (team Ring of Care, Vishwakarma Awards 2026-27, Frontier Diagnostics theme) is a smart
ring that turns Nadi Pariksha (traditional pulse diagnosis) into continuous health screening.
This repo is the companion app: it receives the ring's live packets over Bluetooth Low Energy,
gates them for trustworthiness, and shows heart rate, SpO₂, skin temperature and an
irregular-rhythm screen.

**Stage 3** (due 4 Dec 2026): working v1 prototype ring, demo video (≤ 2 min 30 s) and accuracy
testing. The app must work with the real ring and, for demos without hardware, with a simulator
that sends the exact same packets.

## Tech stack (do not change)
- React 18 + Vite + TypeScript (strict), Tailwind CSS v4, Zustand
- Web Bluetooth (Chrome on Android, Windows, macOS; not iOS). Needs HTTPS (Vercel) or localhost.
- Dexie (IndexedDB) for on-device sessions and validation data. Works offline.
- Firebase Auth + Firestore (optional cloud backup and doctor links), config in `.env.local`
- Vitest for unit tests. Recharts (accuracy and History charts), jsPDF (accuracy PDF) and
  vite-plugin-pwa (installable, offline). Chart screens, jsPDF and Firebase load on demand:
  guests never download Firebase (`auth/authImpl.ts`, `cloud/firestoreApi.ts` behind `cloud/api.ts`).
- Own tiny i18n in `src/i18n/`: English source in `en.ts`, plus Hindi, Tamil, Telugu, Kannada,
  Malayalam, Bengali, Marathi. Every UI string goes through `t()`. Tests enforce that every
  language has every key with the same `{placeholders}`. Translations need native-speaker review.
- Hosted on Vercel (`nadisense-app-phi.vercel.app`, project `nadisense-app` in the Vercel team "Yeswant"). Source also lives in `app/` of
  github.com/yeswantsakthi-hub/NadiSense.

## Ring v1 and the data path
Hardware: Seeed XIAO nRF52840 Sense + MAX30101/MAX32664 (HR, SpO₂, confidence and finger status
on-chip) + TMP117 + on-board IMU + 120 mAh LiPo.

The **BLE contract** is in `src/ring/contract.ts`, and the firmware-facing description is in
`FIRMWARE.md`. Both must change together. Summary:
- Device `NadiSense`, service `…a001`, live data `…a002` (notify), command `…a003`
  (write: `01` start, `02` stop, `03` + uint32 LE Unix seconds).
- Live packet, 16 bytes LE: `uint32 timestamp_ms | u8 hr | u8 spo2 | u8 confidence |
  u8 finger_status (3 = on) | i16 temp×100 | u16 rr_ms | u8 motion | u8 battery | u16 beat_seq`.
  One packet per detected beat, plus a keep-alive at least once a second (rr = 0, same beat_seq).

```
src/ring/
  contract.ts      UUIDs, commands, packet layout, thresholds
  packets.ts       parse/encode the live packet, commands (tested)
  RingSource.ts    interface + PacketSource base: every source hands raw bytes to ONE parser
  BluetoothRing.ts Web Bluetooth: chooser, time sync, start, auto-reconnect with back-off (tested with a fake ring)
  SimulatedRing.ts demo source: beats from data/mockModel.ts encoded as real packets
                   (scenarios: normal, irregular, finger-off, movement, tour = all states in ~2 min
                   for the demo video) (tested)
  diagnostics.ts   link/contract checks for firmware bring-up (Settings → Ring diagnostics) (tested)
  readings.ts      the reading gate (tested)
src/components/SessionMonitor.tsx  packets → live store, beat log, event log, session summary
src/store/         sensorStore (source choice + link status), liveStore, db.ts (Dexie)
src/dsp/           pure functions, tested: rhythm.ts, baseline.ts, trends.ts (History charts)
src/validation/    validation-mode statistics and CSV; accuracy.ts (Bland–Altman), pdfReport.ts (tested)
src/cloud/         optional Firestore backup + doctor links
```

## Product rules (Stage 3)
- **Reading gate:** show HR/SpO₂ only when `finger_status == 3`, `confidence >= 80` and no
  motion. Otherwise show "Place ring" / "Hold still…". Never show a number that failed the gate.
- **Rhythm:** RMSSD and pNN50 from real RR intervals over a 2-minute window, using only
  consecutive beats (`beat_seq` + 1) that are still and plausible (300–2000 ms). Flag when
  pNN50 ≥ 40 % and RMSSD/meanRR ≥ 0.12. Wording: "Possible irregular rhythm — check with a doctor".
  Never say "you have".
- **Temperature:** shown as drift from the person's own baseline (mean of their first 3 sessions
  with ≥ 2 readings). Ring and simulated sessions are kept apart.
- **Coming in v2** (the v1 ring can't measure these): ECG check, blood-pressure trend/cuff
  calibration, Nadi pulse-shape metrics, sleep and apnea risk. Screens stay, marked "Coming in v2",
  and never show numbers.
- **Disclaimer** in Settings, on the rhythm card and on v2 screens: "NadiSense is a screening
  prototype, not a medical device."
- **Offline first:** sign-in is optional ("Use without account", remembered). Sessions and
  validation data live on the phone (Dexie). The cloud backup of session summaries needs explicit
  consent, enforced by Firestore rules too. There are no raw uploads in v1.
- **Validation mode:** timed session (default 2 min) with a volunteer code (never a name),
  reference readings (oximeter HR/SpO₂, thermometer), per-session ring-mean vs reference difference,
  CSV export (samples and accuracy table) through the share sheet.

## Design direction (premium medical instrument, dark)
- Dark only. Tokens in `src/index.css`: black page `#050506` with a faint red glow at the top;
  raised graphite surfaces (`.surface`: `#101113`, hairline `rgba(255,255,255,.07)`, top highlight,
  soft depth) with `rounded-2xl` cards and `rounded-3xl` heroes. Text `#eef0f3` / `#9aa3b2` / `#6b7380`.
- Colour means something: red `#f23a45` (`brand`, white text on buttons) = brand and primary action (`.btn-primary`,
  active tab, selection); green `#3ddc97` (`signal`) = live / trusted; brighter red `#ff4d5e` (`alert`) =
  screening flags only (filled `<Tag tone="alert">` with ⚠); amber = hold still; coral heart,
  cyan SpO₂, gold temperature, violet rhythm.
- Type: the Anek family (Ek Type) for every script: Anek Latin, Devanagari, Tamil, Telugu, Kannada,
  Malayalam, Bangla. Small `.label`s are plain sentence case; IBM Plex Mono only for raw data. Big
  figures are semibold with tabular numerals.
- Brand: `components/Logo.tsx` (ring + pulse mark, "Nadi**Sense**" wordmark). No emoji, no generic
  stock icons; line icons in `components/icons.tsx`.
- Pulse (`Dashboard.tsx`): hero card with status pill, the heart-rate dial (ticks lit to the HR,
  heart pops per beat), the filled live waveform, and the reading gate as three check pills →
  SpO₂ / temperature-drift / rhythm cards with 10-minute sparklines → side column: rhythm analysis
  bars against the flag limits, event timeline, validation shortcut, disclaimer.
- Sign-in and pairing: wordmark bar, then a hero card (large headline, ring on a lit stage, the
  four v1 measurements as chips).
- Shell: sticky blurred header (wordmark, text tabs on desktop, link/battery pill, clock);
  standard bottom tab bar on phones, active tab in brand red. Secondary screens have a large
  page title and sit in a max-w-3xl column. Motion is subtle and off under prefers-reduced-motion.

## Working rules for Claude Code
- Keep `dsp/`, `ring/packets.ts`, `ring/readings.ts` and `validation/model.ts` free of React and
  side effects, and give every function a Vitest test.
- After each task: run `npm run build` and `npm test`, run the app, fix all errors, then give a
  3-line summary and how to test it.
- Do not add libraries beyond the stack above without asking.
- Commit after each task with a clear message.
