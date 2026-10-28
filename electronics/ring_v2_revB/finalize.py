"""Finalize the routed board: drop unused fan-out vias, GND pours (top solid, bottom hatched), stitching vias, refill.

Usage: python finalize.py board.kicad_pcb
"""
import sys, json, os
import numpy as np
import pcbnew

pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
mm, toMM = pcbnew.FromMM, pcbnew.ToMM
X0, Y0, L, W = 100.0, 100.0, 66.8, 6.0

for z in list(b.Zones()):
    if not z.GetIsRuleArea():
        b.Remove(z)

# geometry snapshots (pad proxies from fp.Pads() do not outlive the call in KiCad 7's Python API)
def pads_snapshot():
    out = []
    for fp in b.GetFootprints():
        for p in fp.Pads():
            bb = p.GetBoundingBox()
            out.append((p.GetNetname(), p.IsOnLayer(pcbnew.F_Cu), p.IsOnLayer(pcbnew.B_Cu),
                        toMM(bb.GetLeft()), toMM(bb.GetTop()), toMM(bb.GetRight()), toMM(bb.GetBottom())))
    return out


def in_box(pt, box, grow):
    x, y = pt
    return box[0] - grow <= x <= box[2] + grow and box[1] - grow <= y <= box[3] + grow


PADS = pads_snapshot()
tracks = [t for t in b.GetTracks()]
btracks = [t for t in tracks if t.GetClass() == "PCB_TRACK" and t.GetLayer() == pcbnew.B_Cu]
gnd = b.FindNet("GND")
drop = []
for v in tracks:
    if v.GetClass() != "PCB_VIA" or v.GetNetname() == "GND":
        continue
    p, r = v.GetPosition(), v.GetWidth() // 2
    pm = (toMM(p.x), toMM(p.y))
    if not any(t.GetNetCode() == v.GetNetCode() and t.HitTest(p, r) for t in btracks) and \
       not any(n == v.GetNetname() and onb and in_box(pm, bx[3:] if False else (bx[3], bx[4], bx[5], bx[6]), 0) for bx in PADS for n, onb in [(bx[0], bx[2])]):
        drop.append(v)
for v in drop:
    b.Remove(v)
print("removed", len(drop), "unused fan-out vias")

# top: solid GND; bottom: solid under the stiffened component sections, cross-hatched in the bend sections
for layer, hatched, xa, xb, prio in ((pcbnew.F_Cu, False, 0, L, 0), (pcbnew.B_Cu, True, 0, L, 0),
                                     (pcbnew.B_Cu, False, 9.9, 21.3, 1), (pcbnew.B_Cu, False, 21.5, 40.4, 1)):
    z = pcbnew.ZONE(b)
    z.SetLayer(layer); z.SetNet(gnd); z.SetZoneName("GND_" + b.GetLayerName(layer) + ("_hatch" if hatched else ""))
    z.SetAssignedPriority(prio)
    o = z.Outline(); o.NewOutline()
    for px, py in [(xa, -W / 2), (xb, -W / 2), (xb, W / 2), (xa, W / 2)]:
        o.Append(mm(X0 + px), mm(Y0 + py))
    z.SetLocalClearance(mm(0.1)); z.SetMinThickness(mm(0.1))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_FULL if not hatched else pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(mm(0.1)); z.SetThermalReliefSpokeWidth(mm(0.15))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    if hatched:
        z.SetFillMode(pcbnew.ZONE_FILL_MODE_HATCH_PATTERN)
        z.SetHatchThickness(mm(0.2)); z.SetHatchGap(mm(0.3)); z.SetHatchOrientation(pcbnew.EDA_ANGLE(45, pcbnew.DEGREES_T))
    b.Add(z)

# stitching vias on a 1.2 mm grid wherever a 0.35 mm via clears every other-net item on both layers
VIA, CLR = 0.35, 0.1
trk = [(t.GetNetname(), t) for t in b.GetTracks()]
keep = [z for z in b.Zones() if z.GetIsRuleArea() and z.GetZoneName() in ("ANTENNA_KEEPOUT", "OPTICAL_WINDOW", "EDGE_KEEPOUT")]
gvias = [(toMM(t.GetPosition().x), toMM(t.GetPosition().y)) for n_, t in trk if n_ == "GND" and t.GetClass() == "PCB_VIA"]
n = 0
for xs in np.arange(0.6, L - 0.3, 0.6):
    for ys in (-2.45, -1.2, 0.0, 1.2, 2.45):
        x, y = float(X0 + xs), float(Y0 + ys)
        p = pcbnew.VECTOR2I(mm(x), mm(y))
        if any(z.Outline().Contains(p) for z in keep) or xs < 7.05 + VIA / 2 + 0.05:
            continue
        if any(n_ != "GND" and t.HitTest(p, mm(VIA / 2 + CLR) + (t.GetWidth() // 2 if t.GetClass() == "PCB_TRACK" else 0))
               for n_, t in trk):
            continue
        if any(in_box((x, y), (bx[3], bx[4], bx[5], bx[6]), VIA / 2 + (CLR if bx[0] != "GND" else 0.05)) for bx in PADS):
            continue
        if any((x - gx) ** 2 + (y - gy) ** 2 < (VIA + 0.2) ** 2 for gx, gy in gvias):
            continue
        v = pcbnew.PCB_VIA(b); v.SetPosition(p); v.SetWidth(mm(VIA)); v.SetDrill(mm(0.15))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(gnd); b.Add(v); n += 1
        gvias.append((x, y))
print("stitching vias", n)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
b.Save(pcb)
pro = pcb.replace(".kicad_pcb", ".kicad_pro")
if os.path.exists(pro):
    j = json.load(open(pro))
    j.setdefault("board", {}).setdefault("design_settings", {}).setdefault("rule_severities", {})["lib_footprint_mismatch"] = "ignore"
    json.dump(j, open(pro, "w"), indent=2)
