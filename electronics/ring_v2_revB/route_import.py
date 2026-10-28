"""Import a Freerouting session (.ses) into the board, add GND pours, refill, save.

KiCad 7's ImportSpecctraSES only works inside the GUI, so the session file is parsed here directly.
Usage: python route_import.py NadiSense_ring_v2_revB.kicad_pcb
"""
import sys, re, json, os
import pcbnew

mm = pcbnew.FromMM
pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
SES = next((a[6:] for a in sys.argv if a.startswith("--ses=")), pcb.replace(".kicad_pcb", ".ses"))


def tokens(txt):
    return re.findall(r'\(|\)|"[^"]*"|[^\s()]+', txt)


def parse(tok, i=0):
    out = []
    while i < len(tok):
        t = tok[i]
        if t == "(":
            sub, i = parse(tok, i + 1); out.append(sub)
        elif t == ")":
            return out, i + 1
        else:
            out.append(t.strip('"')); i += 1
    return out, i


POUR_ONLY = "--pour-only" in sys.argv
ses, _ = parse(tokens(open(SES).read())) if not POUR_ONLY else ([["session", ["routes", ["resolution", "um", "10"], ["network_out"]]]], 0)
routes = next(x for x in ses[0] if isinstance(x, list) and x[0] == "routes")
res = next(x for x in routes if isinstance(x, list) and x[0] == "resolution")
unit = {"um": 1000.0, "mm": 1.0}[res[1]] * float(res[2])          # session units per mm
netout = next(x for x in routes if isinstance(x, list) and x[0] == "network_out")
P = lambda x, y: pcbnew.VECTOR2I(mm(float(x) / unit), mm(-float(y) / unit))
layers = {"F.Cu": pcbnew.F_Cu, "B.Cu": pcbnew.B_Cu}
existing = {(v.GetPosition().x, v.GetPosition().y) for v in b.GetTracks() if v.GetClass() == "PCB_VIA"}
nt = nv = 0
for net in netout[1:]:
    ni = b.FindNet(net[1])
    for item in net[2:]:
        if item[0] == "wire":
            path = item[1]
            lay, width = layers[path[1]], float(path[2]) / unit
            pts = [p for p in path[3:] if not isinstance(p, list)]
            for k in range(0, len(pts) - 2, 2):
                t = pcbnew.PCB_TRACK(b)
                t.SetStart(P(pts[k], pts[k + 1])); t.SetEnd(P(pts[k + 2], pts[k + 3]))
                t.SetWidth(mm(width)); t.SetLayer(lay); t.SetNet(ni); b.Add(t); nt += 1
        elif item[0] == "via":
            pos = P(item[2], item[3])
            if (pos.x, pos.y) in existing:
                continue
            m = re.search(r"_(\d+):(\d+)_um", item[1])
            dia, drill = (int(m.group(1)) / 1000, int(m.group(2)) / 1000) if m else (0.35, 0.15)
            v = pcbnew.PCB_VIA(b)
            v.SetPosition(pos); v.SetWidth(mm(dia)); v.SetDrill(mm(drill))
            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(ni); b.Add(v); nv += 1
            existing.add((pos.x, pos.y))
print("imported", nt, "segments,", nv, "vias")
if "--no-pour" in sys.argv:
    b.Save(pcb); sys.exit(0)

gnd = b.FindNet("GND")
X0, Y0, L, W = 100.0, 100.0, 66.8, 6.0
for layer, hatched in ((pcbnew.F_Cu, False), (pcbnew.B_Cu, True)):
    z = pcbnew.ZONE(b)
    z.SetLayer(layer); z.SetNet(gnd); z.SetZoneName("GND_" + b.GetLayerName(layer))
    o = z.Outline(); o.NewOutline()
    for px, py in [(0, -W / 2), (L, -W / 2), (L, W / 2), (0, W / 2)]:
        o.Append(mm(X0 + px), mm(Y0 + py))
    z.SetLocalClearance(mm(0.12)); z.SetMinThickness(mm(0.1))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(mm(0.12)); z.SetThermalReliefSpokeWidth(mm(0.12))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    if hatched:      # cross-hatched ground keeps the bend sections supple
        z.SetFillMode(pcbnew.ZONE_FILL_MODE_HATCH_PATTERN)
        z.SetHatchThickness(mm(0.2)); z.SetHatchGap(mm(0.3)); z.SetHatchOrientation(pcbnew.EDA_ANGLE(45, pcbnew.DEGREES_T))
    b.Add(z)
# drop fan-out vias that ended up used on the top layer only (filled via-in-pad, nothing on the bottom)
b.BuildConnectivity()
removed = 0
for v in [t for t in b.GetTracks() if t.GetClass() == "PCB_VIA" and t.GetNetname() != "GND"]:
    p = v.GetPosition()
    on_b = any(t.GetClass() == "PCB_TRACK" and t.GetLayer() == pcbnew.B_Cu and t.GetNetCode() == v.GetNetCode()
               and t.HitTest(p, v.GetWidth() // 2) for t in b.GetTracks())
    pad_b = any(pd.IsOnLayer(pcbnew.B_Cu) and pd.GetNetCode() == v.GetNetCode() and pd.HitTest(p) for fp in b.GetFootprints() for pd in fp.Pads())
    if not on_b and not pad_b:
        b.Remove(v); removed += 1
print("removed", removed, "unused fan-out vias")
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
b.Save(pcb)

# project file: footprint-library mismatch is expected (component silkscreen moved to Fab)
pro = pcb.replace(".kicad_pcb", ".kicad_pro")
if os.path.exists(pro):
    j = json.load(open(pro))
    sev = j.setdefault("board", {}).setdefault("design_settings", {}).setdefault("rule_severities", {})
    sev["lib_footprint_mismatch"] = "ignore"
    json.dump(j, open(pro, "w"), indent=2)
print("tracks", sum(1 for t in b.GetTracks() if t.GetClass() == "PCB_TRACK"),
      "vias", sum(1 for t in b.GetTracks() if t.GetClass() == "PCB_VIA"))
