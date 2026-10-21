# NadiSense ring v2 — design summary

## Design iterations (Stage 1 → Stage 2)

1. **Form factor:** handheld pulse reader → continuous-wear ring, so night-time events (apnea, paroxysmal AF) are captured.
2. **Sensing:** PPG only → PPG + SpO₂ + skin temperature + motion.
3. **Optical front-end:** MAX30101 → MAX86141. The power budget showed the MAX30101 draws 600 µA in SpO₂ mode and its green LED needs a 4.5–5 V supply; the MAX86141 draws about 11 µA per LED exposure at 25 sps and runs its LEDs from the battery.
4. **Temperature sensor:** MAX30205 → TMP117, so every logic device runs on one 1.8 V rail.
5. **Battery:** 20–40 mAh assumption → 12 mAh, sized from the 245 mm³ cavity in the CAD model.
6. **Shell:** 0.3 mm internal fillets added at the channel corners to remove sharp stress raisers before FEA.

## Nadi Pariksha → PPG mapping

| Traditional parameter | Measurement | Screening use |
|---|---|---|
| Vega (rate) | Heart rate | Baseline deviation |
| Sthiratva / Tala (stability, rhythm) | Beat-to-beat interval variability | AF-type rhythm |
| Kathinya (arterial hardness) | PPG stiffness index | Hypertension-risk trend |
| Gati / Bala (movement, force) | Waveform shape, pulse amplitude | Personal baseline |
| Tapamana (temperature) | Skin temperature | Fever / illness flag |

Basis: review of Nadi Pariksha and pulse-wave analysis, J. Ayurveda Integr. Med. 2019 (PMC6938838).

## Power budget (µA average)

| Mode | Current |
|---|---|
| Night, 8 h (red + IR at 25 sps, continuous) | 98 |
| Day, 16 h (IR spot checks, 10 % duty) | 12 |
| 24 h average | 40 |
| Life on 12 mAh × 80 % usable | 9.9 days (6.0 worst case: 20 mA LEDs, 2× CPU time) |

## FEA — 50 N diametral squeeze, shell only

| Mesh | Elements | DOFs | Peak von Mises | Max deflection |
|---|---|---|---|---|
| Coarse | 22,945 | 135,009 | 9.35 MPa | 0.111 mm |
| Medium | 61,197 | 329,184 | 8.53 MPa | 0.109 mm |
| Fine | 90,507 | 457,659 | 8.46 MPa | 0.115 mm |

Material assumed: rigid SLA resin, E = 2.5 GPa, ν = 0.35, UTS = 50 MPa → FoS = 5.9. Replace with the chosen resin's datasheet values.

## Bill of materials — one ring (estimates, INR)

| Ref | Part | Est. |
|---|---|---|
| U1 | nRF52840 WLCSP | 420 |
| U2 | MAX86141 | 520 |
| U3 | TMP117 | 260 |
| U4 | LIS2DW12 | 140 |
| U5 | BQ25120A | 180 |
| D1, D2, PD1 | Red/IR LEDs, Si photodiode | 220 |
| Y1, AE1, passives | 32 MHz crystal, chip antenna, R/C | 230 |
| PCB | 2-layer polyimide flex | 700 |
| BT1 | 12 mAh curved Li-Po (custom) | 1,200 |
| Mechanical | SLA shell, liner, epoxy, silicone, pogo pads | 500 |
| **Total** | | **4,370** |
