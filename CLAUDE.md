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
- Vitest for unit tests. Still in the stack list but not used yet: Recharts, vite-plugin-pwa, jsPDF.
- Own tiny i18n in `src/i18n/`: English source in `en.ts`, plus Hindi, Tamil, Telugu, Kannada,
  Malayalam, Bengali, Marathi. Every UI string goes through `t()`. Tests enforce that every
  language has every key with the same `{placeholders}`. Translations need native-speaker review.
- Hosted on Vercel (`nadisense-app.vercel.app`). Source also lives in `app/` of
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
                   (scenarios: normal, irregular, finger-off, movement) (tested)
  readings.ts      the reading gate (tested)
src/components/SessionMonitor.tsx  packets → live store, beat log, event log, session summary
src/store/         sensorStore (source choice + link status), liveStore, db.ts (Dexie)
src/dsp/           pure functions, tested: rhythm.ts, baseline.ts
src/validation/    validation-mode statistics and CSV (tested)
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

## Design direction (operations console, like a monitoring dashboard)
- Dark only. Tokens in `src/index.css`: page `#0c0c0d`, charcoal panels `#232426` with a thin
  border `#36383c` and almost square corners (`rounded-[3px]`), no shadows. Text `#e9e9e6`;
  small uppercase olive labels (`.label`, `#a7a47a`); muted `#8d8c86`.
- Colour means state: green `#4cc06a` (`signal`) = live / trusted, amber `#f0a33f` = changes and
  "hold still", red `#e2483f` (`alert`) = screening flags only, blue `#4a90d9` (`select`) =
  focused/selected. Tags are outlined uppercase (`<Tag>`); alert tags are filled with ⚠.
- Roboto, figures with tabular numerals. No glows, neon or glass effects. Primary buttons are
  green with black text; selected chips are outlined green.
- Pulse console (`Dashboard.tsx`): full-width status banner (big status word LIVE / HOLD STILL /
  PLACE RING / NO DATA / POSSIBLE IRREGULAR, title, gate rule, lead + bullets, KPIs) → beat-timing
  chart with axes → metric cards (HR, SpO₂, temp drift, rhythm) with state-coloured borders and
  battery footer. Right column (stacked on phones): event log, rhythm analysis (RMSSD, pNN50
  vs. flag limits), last validation session, disclaimer.
- Sign-in and pairing: spaced `NADISENSE` wordmark bar, then panels (title + ring product shot).
- Shell: header with nav labels (desktop) / context (phone), centred wordmark, link + battery and
  clock on the right; dark bottom tab bar on phones: Pulse · Validate · Nadi (v2) · History ·
  Settings. Other screens use a single max-w-3xl column. Motion is minimal and off under
  prefers-reduced-motion.

## Working rules for Claude Code
- Keep `dsp/`, `ring/packets.ts`, `ring/readings.ts` and `validation/model.ts` free of React and
  side effects, and give every function a Vitest test.
- After each task: run `npm run build` and `npm test`, run the app, fix all errors, then give a
  3-line summary and how to test it.
- Do not add libraries beyond the stack above without asking.
- Commit after each task with a clear message.
