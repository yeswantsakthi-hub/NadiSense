"""Two-layer grid A* router that completes nets the autorouter left open (adds 0.35/0.15 vias where needed).

Usage: python finish2.py board.kicad_pcb NET [NET ...]   (before pours are added)
Each net: the cluster holding the first unconnected item found by KiCad is joined to the rest of the net.
"""
import sys, heapq, math
import numpy as np
from PIL import Image, ImageDraw
import pcbnew

pcb = sys.argv[1]
b = pcbnew.LoadBoard(pcb)
mm, toMM = pcbnew.FromMM, pcbnew.ToMM
X0, Y0, L, W = 100.0, 100.0, 66.8, 6.0
RES = 0.025
TRACK, CLEAR, VIA, DRILL = 0.1, 0.075, 0.35, 0.15
nx, ny = int(L / RES) + 1, int(W / RES) + 1
LAY = (pcbnew.F_Cu, pcbnew.B_Cu)
g = lambda x, y: (int(round((x - X0) / RES)), int(round((y - Y0 + W / 2) / RES)))
w_ = lambda i, j: (float(X0 + int(i) * RES), float(Y0 - W / 2 + int(j) * RES))


def shapes(layer):
    """(net, kind, geometry) for all copper on a layer."""
    for t in b.GetTracks():
        if t.GetClass() == "PCB_TRACK" and t.GetLayer() == layer:
            yield t.GetNetname(), t, "track"
        elif t.GetClass() == "PCB_VIA":
            yield t.GetNetname(), t, "via"
    for fp in b.GetFootprints():
        for p in fp.Pads():
            if p.IsOnLayer(layer):
                yield p.GetNetname(), p, "pad"


def draw(d, item, kind, grow, fill):
    if kind == "track":
        a, c = item.GetStart(), item.GetEnd()
        r = toMM(item.GetWidth()) / 2 + grow
        pa, pc = g(toMM(a.x), toMM(a.y)), g(toMM(c.x), toMM(c.y))
        d.line([pa, pc], fill=fill, width=max(1, int(2 * r / RES)))
        for p in (pa, pc):
            d.ellipse([p[0] - r / RES, p[1] - r / RES, p[0] + r / RES, p[1] + r / RES], fill=fill)
    elif kind == "via":
        p = item.GetPosition(); r = (toMM(item.GetWidth()) / 2 + grow) / RES
        c = g(toMM(p.x), toMM(p.y))
        d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill)
    else:
        bb = item.GetBoundingBox()
        p0 = g(toMM(bb.GetLeft()) - grow, toMM(bb.GetTop()) - grow)
        p1 = g(toMM(bb.GetRight()) + grow, toMM(bb.GetBottom()) + grow)
        if item.GetShape() == pcbnew.PAD_SHAPE_CIRCLE:
            d.ellipse([p0, p1], fill=fill)
        else:
            d.rectangle([p0, p1], fill=fill)


def raster(fn):
    im = Image.new("L", (nx, ny), 0); fn(ImageDraw.Draw(im)); return np.array(im) > 0


def route(net, masks=None):
    ni = b.FindNet(net)
    items = []
    for t in b.GetTracks():
        if t.GetNetname() == net:
            items.append(t)
    for fp in b.GetFootprints():
        for p in fp.Pads():
            if p.GetNetname() == net:
                items.append(p)
    layers_of = lambda it: [l for l in LAY if (it.GetClass() == "PCB_VIA" or it.IsOnLayer(l))]
    def pts(it):
        if it.GetClass() == "PCB_TRACK":
            return [it.GetStart(), it.GetEnd()]
        return [it.GetPosition()]
    def touch(a, c):
        if not set(layers_of(a)) & set(layers_of(c)):
            return False
        for p in pts(a):
            if c.HitTest(p, 1000):
                return True
        for p in pts(c):
            if a.HitTest(p, 1000):
                return True
        return False
    parent = list(range(len(items)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if find(i) != find(j) and touch(items[i], items[j]):
                parent[find(i)] = find(j)
    groups = {}
    for i, it in enumerate(items):
        groups.setdefault(find(i), set()).add(it.m_Uuid.AsString())
    clusters = list(groups.values())
    if len(clusters) < 2 and masks is None:
        print(" ", net, "connected"); return "done"
    startids = min(clusters, key=len) if masks is None else set()
    inflate = CLEAR + TRACK / 2 + 0.015          # margin for grid rounding
    blocked, start, goal = {}, {}, {}
    e = int(round((0.15 + TRACK / 2) / RES))
    for lay in LAY:
        def obst(d, lay=lay):
            for n, it, k in shapes(lay):
                if n != net:
                    draw(d, it, k, inflate, 255)
            d.rectangle([0, 0, nx, e], fill=255); d.rectangle([0, ny - e, nx, ny], fill=255)
        blocked[lay] = raster(obst)
        start[lay] = raster(lambda d, lay=lay: [draw(d, it, k, 0, 255) for n, it, k in shapes(lay)
                                               if n == net and it.m_Uuid.AsString() in startids])
        goal[lay] = raster(lambda d, lay=lay: [draw(d, it, k, 0, 255) for n, it, k in shapes(lay)
                                              if n == net and it.m_Uuid.AsString() not in startids])
        if masks is not None:
            start[lay], goal[lay] = masks[0][lay], masks[1][lay]
        blocked[lay] &= ~(start[lay] | goal[lay])
    # where a new via may go: clear of other-net copper on both layers by via radius + clearance
    vr = VIA / 2 + CLEAR + 0.015
    via_bad = raster(lambda d: [draw(d, it, k, vr, 255) for lay in LAY for n, it, k in shapes(lay) if n != net])
    via_bad[:, :int(7.4 / RES)] = True                                  # antenna keep-out
    ow = (int((21.3 - 0) / RES), int((27.3 - 0) / RES), int((1.0) / RES), int((5.0) / RES))
    via_bad[ow[2]:ow[3], ow[0]:ow[1]] = True                            # optical window (top)
    ev = int(round((0.15 + VIA / 2) / RES)); via_bad[:ev] = True; via_bad[-ev:] = True
    # A*
    gl = [np.argwhere(goal[l]) for l in LAY]
    allg = np.vstack([x for x in gl if len(x)])
    cy, cx = allg.mean(0)
    hfun = lambda i, j: math.hypot(i - cx, j - cy) * 0.5
    dist = {}; prev = {}; pq = []
    for li, lay in enumerate(LAY):
        for j, i in np.argwhere(start[lay])[::2]:
            dist[(li, i, j)] = 0.0; heapq.heappush(pq, (hfun(i, j), 0.0, li, i, j))
    steps = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
    end = None; it_n = 0
    while pq:
        f, dc, li, i, j = heapq.heappop(pq)
        if dc > dist.get((li, i, j), 1e18):
            continue
        it_n += 1
        lay = LAY[li]
        if goal[lay][j, i]:
            end = (li, i, j); break
        for di, dj, c in steps:
            a, bb = i + di, j + dj
            if 0 <= a < nx and 0 <= bb < ny and not blocked[lay][bb, a]:
                nd = dc + c * (1.0 if li == 0 else 1.0)
                if nd < dist.get((li, a, bb), 1e18):
                    dist[(li, a, bb)] = nd; prev[(li, a, bb)] = (li, i, j)
                    heapq.heappush(pq, (nd + hfun(a, bb), nd, li, a, bb))
        if not via_bad[j, i] and not blocked[LAY[1 - li]][j, i]:
            nd = dc + 40
            k = (1 - li, i, j)
            if nd < dist.get(k, 1e18):
                dist[k] = nd; prev[k] = (li, i, j); heapq.heappush(pq, (nd + hfun(i, j), nd, 1 - li, i, j))
    if end is None:
        print("  no path for", net); return False
    path = [end]
    while path[-1] in prev:
        path.append(prev[path[-1]])
    path = path[::-1]
    # split into layer runs, string-pull each run
    runs, cur = [], [path[0]]
    for p in path[1:]:
        if p[0] != cur[-1][0]:
            runs.append(cur); cur = [p]
        else:
            cur.append(p)
    runs.append(cur)

    def los(lay, a, c):
        n = int(max(abs(c[0] - a[0]), abs(c[1] - a[1]))) + 1
        for t in np.linspace(0, 1, 2 * n):
            if blocked[lay][int(round(a[1] + (c[1] - a[1]) * t)), int(round(a[0] + (c[0] - a[0]) * t))]:
                return False
        return True
    nseg = 0
    for r_ in runs:
        lay = LAY[r_[0][0]]
        pts = [(p[1], p[2]) for p in r_]
        out = [pts[0]]; k = 0
        while k < len(pts) - 1:
            nxt = k + 1
            for m_ in range(len(pts) - 1, k, -1):
                if los(lay, pts[k], pts[m_]):
                    nxt = m_; break
            out.append(pts[nxt]); k = nxt
        for a, c in zip(out, out[1:]):
            t = pcbnew.PCB_TRACK(b)
            t.SetStart(pcbnew.VECTOR2I(mm(w_(*a)[0]), mm(w_(*a)[1]))); t.SetEnd(pcbnew.VECTOR2I(mm(w_(*c)[0]), mm(w_(*c)[1])))
            t.SetWidth(mm(TRACK)); t.SetLayer(lay); t.SetNet(ni); b.Add(t); nseg += 1
    for r_ in runs[1:]:
        _, i, j = r_[0]
        v = pcbnew.PCB_VIA(b); x, y = w_(i, j)
        v.SetPosition(pcbnew.VECTOR2I(mm(x), mm(y))); v.SetWidth(mm(VIA)); v.SetDrill(mm(DRILL))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(ni); b.Add(v)
    print(f"  routed {net}: {nseg} segments, {len(runs) - 1} vias, {len(path) * RES:.1f} mm")
    return True


for n in (sys.argv[2:] if __name__ == "__main__" else []):
    for _ in range(4):              # a net may need several joins
        r = route(n)
        if r == "done" or r is False:
            break
if __name__ == "__main__":
    b.Save(pcb)
