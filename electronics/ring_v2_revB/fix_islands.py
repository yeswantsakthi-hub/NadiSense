"""Tie every GND pour fragment into one ground: graph of pour fragments + GND vias + GND pads, add stitching vias
where an isolated fragment overlaps a fragment of the main ground on the other layer. Then refill and save.
"""
import sys, math
import numpy as np
from matplotlib.path import Path
import pcbnew

mm, toMM = pcbnew.FromMM, pcbnew.ToMM
pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
gnd = b.FindNet("GND")
VIA, CLR = 0.35, 0.1


def snapshot():
    frags = []                                      # (layer, Path)
    for z in b.Zones():
        if z.GetIsRuleArea() or z.GetNetname() != "GND":
            continue
        poly = z.GetFilledPolysList(z.GetLayer())
        for i in range(poly.OutlineCount()):
            o = poly.Outline(i)
            pts = np.array([[toMM(o.CPoint(k).x), toMM(o.CPoint(k).y)] for k in range(o.PointCount())])
            if len(pts) >= 3:
                frags.append((z.GetLayer(), Path(pts)))
    vias = [(toMM(t.GetPosition().x), toMM(t.GetPosition().y), toMM(t.GetWidth()) / 2)
            for t in b.GetTracks() if t.GetClass() == "PCB_VIA" and t.GetNetname() == "GND"]
    pads = []
    for fp in b.GetFootprints():
        for p in fp.Pads():
            if p.GetNetname() == "GND":
                pads.append((toMM(p.GetPosition().x), toMM(p.GetPosition().y), p.IsOnLayer(pcbnew.F_Cu), p.IsOnLayer(pcbnew.B_Cu)))
    return frags, vias, pads


def components(frags, vias, pads):
    n = len(frags) + len(vias) + len(pads)
    par = list(range(n))
    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    def u(a, c):
        par[f(a)] = f(c)
    for vi, (x, y, r) in enumerate(vias):
        for fi, (lay, path) in enumerate(frags):
            if path.contains_point((x, y)):
                u(len(frags) + vi, fi)
    for pi_, (x, y, onf, onb) in enumerate(pads):
        for fi, (lay, path) in enumerate(frags):
            if (lay == pcbnew.F_Cu and onf or lay == pcbnew.B_Cu and onb) and path.contains_point((x, y)):
                u(len(frags) + len(vias) + pi_, fi)
    comp = {}
    for fi in range(len(frags)):
        comp.setdefault(f(fi), []).append(fi)
    return sorted(comp.values(), key=lambda c: -sum(float(np.ptp(frags[i][1].vertices[:, 0])) for i in c))


trk = [(t.GetNetname(), t) for t in b.GetTracks()]
pad_boxes = []
for fp in b.GetFootprints():
    for p in fp.Pads():
        bb = p.GetBoundingBox()
        pad_boxes.append((p.GetNetname(), toMM(bb.GetLeft()), toMM(bb.GetTop()), toMM(bb.GetRight()), toMM(bb.GetBottom())))
keep = [z for z in b.Zones() if z.GetIsRuleArea() and z.GetZoneName() in ("ANTENNA_KEEPOUT", "OPTICAL_WINDOW")]


def fits(x, y):
    p = pcbnew.VECTOR2I(mm(x), mm(y))
    if x < 107.05 + VIA / 2 + 0.05 or abs(y - 100) > 3 - 0.15 - VIA / 2:
        return False
    if any(z.Outline().Contains(p) for z in keep):
        return False
    if any(n != "GND" and t.HitTest(p, mm(VIA / 2 + CLR) + (t.GetWidth() // 2 if t.GetClass() == "PCB_TRACK" else 0)) for n, t in trk):
        return False
    if any(n != "GND" and l - VIA / 2 - CLR <= x <= r + VIA / 2 + CLR and tp - VIA / 2 - CLR <= y <= bt + VIA / 2 + CLR
           for n, l, tp, r, bt in pad_boxes):
        return False
    return True


for rnd in range(6):
    frags, vias, pads = snapshot()
    comps = components(frags, vias, pads)
    if len(comps) == 1:
        print("ground connected"); break
    main = set(comps[0])
    added = 0
    for comp in comps[1:]:
        done = False
        for fi in comp:
            lay, path = frags[fi]
            others = [frags[j][1] for j in main if frags[j][0] != lay]
            (x0, y0), (x1, y1) = path.vertices.min(0), path.vertices.max(0)
            for x in np.arange(x0 + 0.18, x1 - 0.17, 0.05):
                for y in np.arange(y0 + 0.18, y1 - 0.17, 0.05):
                    x, y = float(x), float(y)
                    if not (path.contains_point((x, y)) and all(path.contains_point((x + VIA * math.cos(a), y + VIA * math.sin(a))) for a in np.linspace(0, 6.28, 8))):
                        continue
                    if not any(o.contains_point((x, y)) and all(o.contains_point((x + VIA * math.cos(a), y + VIA * math.sin(a))) for a in np.linspace(0, 6.28, 8)) for o in others):
                        continue
                    if not fits(x, y):
                        continue
                    v = pcbnew.PCB_VIA(b); v.SetPosition(pcbnew.VECTOR2I(mm(x), mm(y))); v.SetWidth(mm(VIA)); v.SetDrill(mm(0.15))
                    v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(gnd); b.Add(v); added += 1; done = True
                    break
                if done:
                    break
            if done:
                break
        if not done:
            c = frags[comp[0]][1].vertices.mean(0)
            print(f"  island near ({c[0] - 100:.1f}, {c[1] - 100:.1f}) mm could not be stitched")
    print(f"round {rnd}: {len(comps)} ground islands, added {added} vias")
    pcbnew.ZONE_FILLER(b).Fill(b.Zones())
    if added == 0:
        break
b.Save(pcb)
