# NadiSense — continuous-wear smart ring for overnight pulse-based screening

**Vishwakarma Awards 2026-27 · Frontier Diagnostics: The Next Vital Signs · Application ID VK26-AU-FD-0015**
Rajalakshmi Engineering College, Chennai · Team: [team name] · Faculty guide: [name]

NadiSense turns Nadi Pariksha — the traditional reading of the pulse's rate, rhythm, force and hardness — into
measurable photoplethysmography (PPG) features. A finger-worn ring records the pulse wave, SpO₂, skin temperature
and motion through the night and flags risk for:

- **AF-type irregular rhythm** (beat-to-beat interval variability)
- **Sleep-apnea risk** (overnight SpO₂ desaturation events)
- **Hypertension risk trends** (PPG stiffness index — Kathinya)
- **Baseline deviation** (heart rate, temperature)

It screens and refers to a clinician; it does not diagnose or report blood-pressure numbers.

## Repository layout

| Folder | Contents |
|---|---|
| `cad/` | Parametric ring model (`nadisense_ring.py`, CadQuery), full assembly `NadiSense_Ring_v2.step`, shell `Outer_shell.step`, one STL per part, render script |
| `fea/` | Linear-static FEA of the shell (`fea_squeeze.py`), results for three meshes (`fea_results.jsonl`), stress plot |
| `electronics/kicad/` | KiCad 7 project: wired schematic, project symbol library, ERC report (0 errors, 0 warnings), netlist, PDF and PNG of the sheet, generator script |
| `electronics/` | Power budget (`power_budget.py` + results) |
| `renders/` | Assembled, half-section and exploded views |
| `docs/` | Design summary, Stage 2 deck PDF, FreeCAD and KiCad screenshots |
| `app/` | Companion app (React + Vite + Firebase), live at https://nadisense-app.vercel.app, runs on simulated sensor data until the ring is built |

## Key design numbers

| Item | Value | Source |
|---|---|---|
| Ring envelope | ID 19 mm, OD 26 mm, width 8 mm | `cad/nadisense_ring.py` |
| Battery | 12 mAh curved Li-Po (245 mm³ cavity) | CAD volume |
| Average current | 40 µA (night 98 µA, day 12 µA) | `electronics/power_budget.py` |
| Battery life | 9.9 days nominal, 6.0 days worst case | `electronics/power_budget.py` |
| Shell FEA, 50 N squeeze | Peak von Mises 8.5 MPa, deflection 0.12 mm, FoS 5.9 | `fea/fea_results.jsonl` |
| Mesh convergence | 9.35 → 8.53 → 8.46 MPa (0.8 % last step) | `fea/fea_results.jsonl` |
| Unit BOM (estimate) | ₹4,370 | `docs/design_summary.md` |

## Reproduce

```bash
pip install cadquery pyvista tetgen scikit-fem pyamg kiutils matplotlib
python cad/nadisense_ring.py cad/            # STEP + STL
python cad/render_pv.py cad/ renders/         # renders
python fea/fea_squeeze.py cad/ fea/ 0.08 0.5 pq2.0Q plot   # FEA (about 4 min, about 3 GB RAM)
python electronics/power_budget.py           # power budget
python electronics/kicad/kicad_gen.py electronics/kicad/   # KiCad schematic (needs KiCad 7 symbol libraries)
```

## Hardware

nRF52840 (BLE 5 SoC) · MAX86141 optical AFE with red 660 nm / IR 880 nm LEDs and Si photodiode · TMP117 (±0.1 °C) ·
LIS2DW12 accelerometer · BQ25120A charger with 2.2 µH buck inductor (3.3 V SYS) · 12 mAh Li-Po · biocompatible SLA resin shell with clear optical window.

Renders, the schematic image and the FEA plot were generated with AI assistance from these design files.
