#!/bin/sh
# Rebuild the NadiSense flex PCB from the schematic netlist.
# Needs KiCad 7 (pcbnew Python module + kicad-cli), the kicad-footprints package, Java 17+ and
# freerouting-1.9.0.jar (https://github.com/freerouting/freerouting/releases). Headless runs need xvfb-run.
set -e
cd "$(dirname "$0")"
FR=${FREEROUTING:-freerouting.jar}
python3 pcb_gen.py                                   # footprints, outline, rules, placement, DSN
xvfb-run -a java -jar "$FR" -de NadiSense_flex.dsn -do NadiSense_flex.ses -mp 100 -oit 2
python3 route_import.py NadiSense_flex.kicad_pcb     # tracks, vias, GND pours
KICAD7_FOOTPRINT_DIR=/usr/share/kicad/footprints python3 drc.py NadiSense_flex.kicad_pcb DRC.rpt
grep '^\*\* Found' DRC.rpt
