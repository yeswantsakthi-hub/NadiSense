#!/bin/sh
# Rebuild the Rev B schematic and PCB checks from design.py. Needs KiCad 7 (pcbnew Python + kicad-cli),
# kicad-footprints/kicad-symbols, kiutils, Java 17+ and freerouting-1.9.0.jar ($FREEROUTING); headless needs xvfb-run.
# The committed .kicad_pcb is the routed result; re-routing from scratch reproduces steps 3-5 of README "How the board was built".
set -e
cd "$(dirname "$0")"
python3 build_sch.py
kicad-cli sch export netlist -o NadiSense_ring_v2_revB.net NadiSense_ring_v2_revB.kicad_sch
python3 verify_net.py
KICAD7_FOOTPRINT_DIR=/usr/share/kicad/footprints python3 drc.py NadiSense_ring_v2_revB.kicad_pcb DRC.rpt
grep '^\*\* Found' DRC.rpt
python3 verify_pcb.py
python3 make_outputs.py "${TMPDIR:-/tmp}/nadisense_svg"
python3 drawings.py
python3 render3d.py images
