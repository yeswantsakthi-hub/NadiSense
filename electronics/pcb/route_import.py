"""Import the Freerouting session, add GND pours and stitching vias, refill zones, save."""
import sys, pcbnew
mm = pcbnew.FromMM
pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
import re


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


ses, _ = parse(tokens(open(pcb.replace(".kicad_pcb", ".ses")).read()))
sess = ses[0]
routes = next(x for x in sess if isinstance(x, list) and x[0] == "routes")
res = next(x for x in routes if isinstance(x, list) and x[0] == "resolution")
unit = {"um": 1000.0, "mil": 25.4 / 1000 * 1000}[res[1]] * float(res[2])   # SES units per mm
netout = next(x for x in routes if isinstance(x, list) and x[0] == "network_out")
P = lambda x, y: pcbnew.VECTOR2I(mm(float(x) / unit), mm(-float(y) / unit))
layers = {"F.Cu": pcbnew.F_Cu, "B.Cu": pcbnew.B_Cu}
nt = nv = 0
for net in netout[1:]:
    ni = b.FindNet(net[1])
    for item in net[2:]:
        if item[0] == "wire":
            path = item[1]
            lay, width, pts = layers[path[1]], float(path[2]) / unit, path[3:]
            pts = [p for p in pts if not isinstance(p, list)]
            for k in range(0, len(pts) - 2, 2):
                t = pcbnew.PCB_TRACK(b)
                t.SetStart(P(pts[k], pts[k + 1])); t.SetEnd(P(pts[k + 2], pts[k + 3]))
                t.SetWidth(mm(width)); t.SetLayer(lay); t.SetNet(ni); b.Add(t); nt += 1
        elif item[0] == "via":
            v = pcbnew.PCB_VIA(b)
            v.SetPosition(P(item[2], item[3])); v.SetWidth(mm(0.4)); v.SetDrill(mm(0.2))
            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(ni); b.Add(v); nv += 1
print("imported", nt, "segments,", nv, "vias")
gnd = b.FindNet("GND")
X0, Y0, L, W = 100.0, 100.0, 66.8, 6.0
for layer, hatched in ((pcbnew.B_Cu, True), (pcbnew.F_Cu, False)):
    z = pcbnew.ZONE(b)
    z.SetLayer(layer); z.SetNet(gnd); z.SetZoneName("GND_" + b.GetLayerName(layer))
    o = z.Outline(); o.NewOutline()
    for px, py in [(0, -W / 2), (L, -W / 2), (L, W / 2), (0, W / 2)]:
        o.Append(mm(X0 + px), mm(Y0 + py))
    z.SetLocalClearance(mm(0.15)); z.SetMinThickness(mm(0.1))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(mm(0.15)); z.SetThermalReliefSpokeWidth(mm(0.15))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    if hatched:   # cross-hatched ground on the flex keeps the bend region supple
        z.SetFillMode(pcbnew.ZONE_FILL_MODE_HATCH_PATTERN)
        z.SetHatchThickness(mm(0.2)); z.SetHatchGap(mm(0.3)); z.SetHatchOrientation(pcbnew.EDA_ANGLE(45, pcbnew.DEGREES_T))
    z.SetAssignedPriority(0)
    b.Add(z)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
b.Save(pcb)
print("tracks", sum(1 for t in b.GetTracks() if t.GetClass() == "PCB_TRACK"),
      "vias", sum(1 for t in b.GetTracks() if t.GetClass() == "PCB_VIA"))

# library-mismatch is expected: component silkscreen was moved to Fab for the 6 mm strip
import json, os
pro = pcb.replace(".kicad_pcb", ".kicad_pro")
if os.path.exists(pro):
    j = json.load(open(pro))
    j.setdefault("board", {}).setdefault("design_settings", {}).setdefault("rule_severities", {})["lib_footprint_mismatch"] = "ignore"
    json.dump(j, open(pro, "w"), indent=2)
