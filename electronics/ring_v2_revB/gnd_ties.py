"""Tie the inner GND balls of the chip-scale packages to an outer GND ball with short top-layer tracks.
On two layers the ring of signal balls fences the inner ground pour in, so it needs an explicit link."""
import sys, pcbnew
mm = pcbnew.FromMM
pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
gnd = b.FindNet("GND")
fp = {f.GetReference(): f for f in b.GetFootprints()}


def pad(ref, num):
    for p in fp[ref].Pads():
        if p.GetNumber() == num:
            return p.GetPosition()
    raise KeyError(ref + num)


def track(*pts):
    for a, c in zip(pts, pts[1:]):
        t = pcbnew.PCB_TRACK(b); t.SetStart(a); t.SetEnd(c); t.SetWidth(mm(0.1)); t.SetLayer(pcbnew.F_Cu); t.SetNet(gnd); b.Add(t)


# nRF52840: VSS_PA (C1, outer) -> empty D1/D2 site -> VSS (D3, inner)
c1, d3 = pad("U1", "C1"), pad("U1", "D3")
mid = pcbnew.VECTOR2I(c1.x + mm(0.35), d3.y)
track(c1, mid, d3)
# nRF52840: B7 (VSS) is fenced in by signal balls on both layers. The unused GPIO P0.29 (C7) is tied to GND
# (default GPIO state is a disconnected input) so B7 -> C7 -> D7 links it to the inner ground on the top layer.
c7 = [p for p in fp["U1"].Pads() if p.GetNumber() == "C7"][0]
c7.SetNet(gnd)
track(pad("U1", "B7"), pad("U1", "C7"), pad("U1", "D7"))
# MAX86141: GND_DIG (C3) and GND_ANA (C4) -> PGND (D3, outer row)
track(pad("U2", "C3"), pad("U2", "D3"))
track(pad("U2", "C4"), pad("U2", "D3"))
# BQ25120A: ILIM (C2, tied to GND) -> GND (A1, outer) along the empty column-1/2 gap is blocked; use B2? no - via handles it
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
b.Save(pcb)
print("ground ties added")
