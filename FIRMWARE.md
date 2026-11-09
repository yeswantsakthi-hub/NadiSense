# What the NadiSense ring v1 firmware must send

The app's side of this contract is `src/ring/contract.ts` and `src/ring/packets.ts`, and both are
unit-tested. If anything here changes, change those files and their tests in the same commit.

Hardware: Seeed XIAO nRF52840 Sense (BLE 5) · MAX30101 + MAX32664 (HR, SpO₂, confidence,
finger status on-chip) · TMP117 skin temperature · on-board IMU · 120 mAh LiPo.

## 1. Advertising

| Item | Value |
|---|---|
| Device name | `NadiSense` (exactly; the app filters on it) |
| Advertised service UUID | `4e534e00-0000-4000-8000-00000000a001` (include it in the advertisement or scan response) |
| Connectable | yes, one central at a time |

## 2. GATT

| Characteristic | UUID | Properties |
|---|---|---|
| Service | `4e534e00-0000-4000-8000-00000000a001` | primary |
| Live data | `4e534e00-0000-4000-8000-00000000a002` | **notify** (CCCD required) |
| Command | `4e534e00-0000-4000-8000-00000000a003` | **write** and/or write without response |

No other services are required. Battery comes inside the live packet.

## 3. Commands (app → ring, on the Command characteristic)

| Bytes | Meaning | Ring must |
|---|---|---|
| `01` | Start | start measuring and notifying live packets |
| `02` | Stop | stop notifying (sent when the user disconnects) |
| `03 tt tt tt tt` | Set time | uint32 **little-endian Unix time in seconds**. Store it for logs. It does **not** change `timestamp_ms`. |

On every connect the app writes `03 + time` first, then `01`. Accept both in any state and ignore
unknown bytes. The ring may also stream without `01` (the app handles both).

## 4. Live packet (ring → app, notify)

Exactly **16 bytes, little-endian**:

| Offset | Type | Field | Rules |
|---|---|---|---|
| 0 | uint32 | `timestamp_ms` | milliseconds since ring boot, monotonic (wraps after ~49 days) |
| 4 | uint8 | `hr_bpm` | from MAX32664; **0 = no reading** |
| 5 | uint8 | `spo2_pct` | from MAX32664; **0 = no reading** |
| 6 | uint8 | `confidence` | MAX32664 HR confidence, 0–100 |
| 7 | uint8 | `finger_status` | MAX32664 skin-contact state; **3 = finger on**, anything else = off |
| 8 | int16 | `skin_temp_c_x100` | TMP117 °C × 100 (e.g. 3412 = 34.12 °C); **-32768 = no reading** |
| 10 | uint16 | `rr_interval_ms` | interval (ms) **ending at the beat that triggered this packet**; **0 = no new beat** |
| 12 | uint8 | `motion_flag` | **1 = moving** (from the IMU), else 0 |
| 13 | uint8 | `battery_pct` | 0–100 |
| 14 | uint16 | `beat_seq` | **+1 for every detected beat**, wraps 65535 → 0 (was "reserved") |

### When to send

- **One packet on every detected beat**, with that beat's `rr_interval_ms` and an incremented `beat_seq`.
- If no beat is detected for 1 s (finger off, poor signal), send a **keep-alive** packet at least
  once a second with `rr_interval_ms = 0` and an **unchanged** `beat_seq`.
- Never send two packets with a new `rr_interval_ms` for the same beat.

Why: the app's irregular-rhythm screen (RMSSD and % of successive differences over 50 ms over
2 minutes) only compares beats whose `beat_seq` differs by exactly 1. One interval per 1 Hz packet
would skip beats and give wrong numbers.

### Field rules the app relies on

- Heart rate and SpO₂ are shown only when `finger_status == 3` **and** `confidence >= 80`
  **and** `motion_flag == 0`. Otherwise the app shows "Place ring" or "Hold still…". Send what the
  MAX32664 reports; don't fake values to pass the gate.
- `rr_interval_ms` must be plausible (300–2000 ms). The app drops others, and drops intervals
  while `motion_flag == 1`.
- Skin temperature is used whenever `finger_status == 3` (sample the TMP117 every 1–10 s).
- The app treats the link as silent after **4 s** without a packet.

## 5. Connection behaviour

- After a disconnect, go back to advertising straight away. The app retries at 1, 2, 4 … 15 s
  and calls `03` + `01` again after reconnecting.
- Keep the MTU default-safe: 16-byte notifications fit the minimum ATT MTU (23).
- Connection interval 30–100 ms is plenty for ~1–2 packets a second.

## 6. Open checks for the team

1. **Beat-to-beat intervals.** Confirm your MAX32664 firmware variant reports beat intervals
   (some algorithm modes only give HR/SpO₂). If it doesn't, compute beat times on the nRF52840
   from the MAX30101 raw IR samples (peak detection), or the rhythm screen cannot work.
2. **Finger status mapping.** Confirm the MAX32664 "skin contact" / SCD state values on your
   board. The app treats only `3` as "on".
3. **Motion flag.** Pick an IMU threshold that matches what moves the PPG on your ring (start with
   acceleration-magnitude standard deviation > 0.03 g over 0.5 s, the same rule the app used in Stage 2).

## 7. Test vector

This packet must decode to HR 72, SpO₂ 98, confidence 95, finger on, 34.12 °C, RR 833 ms, still,
battery 87 %, beat 4242, timestamp 123456789 ms:

```
15 cd 5b 07  48 62 5f 03  54 0d 41 03  00 57 92 10
```
