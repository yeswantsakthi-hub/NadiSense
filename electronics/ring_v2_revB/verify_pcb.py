"""Check every pad's net on the board against design.py (the schematic's source)."""
import sys, pcbnew
import design as D
b = pcbnew.LoadBoard(sys.argv[1] if len(sys.argv) > 1 else "NadiSense_ring_v2_revB.kicad_pcb")
bad = 0; n = 0
for fp in b.GetFootprints():
    ref = fp.GetReference()
    want = D.PARTS[ref][3]
    for p in fp.Pads():
        num = p.GetNumber()
        if not num:
            continue
        got = p.GetNetname().lstrip("/")
        exp = want.get(num, "")
        n += 1
        if got != exp:
            print("MISMATCH", ref, num, "board:", got or "-", "design:", exp or "-"); bad += 1
print("pads checked", n, "mismatches", bad)
