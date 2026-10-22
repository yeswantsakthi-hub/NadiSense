# NadiSense companion app

Live: **https://nadisense-app.vercel.app**

The phone app for the NadiSense ring. It receives the ring's sensor data, shows the live pulse
waveform, flags movement, and keeps a history the user can share with a doctor. Until the ring
hardware is connected it runs on realistic simulated data (normal, irregular-rhythm and
sleep-apnea scenarios), and switches to the real ring over Bluetooth with no screen changes.

A screening companion, not a diagnostic device.

## What it does today

- **Live pulse console**: 400 Hz infrared PPG waveform, accelerometer strip, movement detection
  that shades and excludes disturbed stretches, event log, stream status, skin temperature.
- **Accounts**: email and password sign-in (Firebase Authentication), password reset.
- **8 languages**: English, हिन्दी, தமிழ், తెలుగు, ಕನ್ನಡ, മലയാളം, বাংলা, मराठी.
- **Cloud backup with consent**: nothing leaves the phone until the user turns on
  "Back up session summaries" and/or "Save raw recordings". The database rules enforce the
  same switches on the server.
- **Profile**: age, sex, height, weight and a blood-pressure cuff reading for calibration.
- **History**: 7- and 30-day tables of time worn, movement and temperature.
- **Doctor links**: a read-only 7-day summary a doctor can open without an account.
  Expires after 7 days and can be revoked.
- **Your data**: export everything as JSON, delete cloud data, delete the account.

Coming next: heart rate, SpO₂, HRV and breathing rate from the signal; ECG check with rhythm
flag and blood-pressure trend; Nadi pulse metrics (gati, bala, stiffness, regularity); the real
ring over Bluetooth; clinician PDF; install as a phone app.

## Tech

React 18, TypeScript, Vite, Tailwind CSS, Zustand, Firebase (Auth + Firestore, Mumbai region),
Vitest. Hosted on Vercel. Project notes for contributors are in [CLAUDE.md](CLAUDE.md).

```
src/
  data/      sensor sources (simulated ring now, Bluetooth ring later)
  dsp/       signal processing, pure functions with tests
  cloud/     Firestore data model and calls
  auth/      Firebase sign-in
  i18n/      translations
  screens/   app screens
  components/
firestore.rules   database security rules
```

## Run it locally

Needs Node.js 20 or newer.

```bash
cd app
npm install
cp .env.example .env.local   # then fill in the Firebase web-app values
npm run dev
```

Without `.env.local` the app still runs; the sign-in page offers "Continue without account".

```bash
npm test         # unit tests
npm run build    # type-check and production build
```

## Deploy

- Website: `npx vercel deploy --prod` (Firebase values are set as Vercel environment variables).
- Database rules: `npx firebase-tools deploy --only firestore:rules`.
