"""3D renders built directly from the routed Rev B board (pads, tracks, vias, parts as package-size bodies).

Usage: python render3d.py <out_dir>   -> pcb3d_flat.png, pcb3d_ring.png
"""
import os, sys, math
import numpy as np
import pyvista as pv
import pcbnew

pv.OFF_SCREEN = True
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else HERE
b = pcbnew.LoadBoard(os.path.join(HERE, "NadiSense_ring_v2_revB.kicad_pcb"))
X0, Y0, L, W, T = 100.0, 100.0, 66.8, 6.0, 0.11
TC = 0.018                       # copper + finish thickness (exaggerated slightly for visibility)
toMM = pcbnew.ToMM

items = []                       # (mesh, colour, specular, specular_power)
POLY, COPPER, GOLD = "#C8701F", "#E39A4F", "#E9C25C"


def box(x0, x1, y0, y1, z0, z1, col, spec=0.3, sp=20, n=None):
    nx = n or max(1, int((x1 - x0) / 0.3))
    m = pv.Box(bounds=(x0, x1, y0, y1, z0, z1), level=(nx, 1, 1)).triangulate()
    items.append((m, col, spec, sp))


# board (y flipped so +y on the PCB is "down" in KiCad)
box(0, L, -W / 2, W / 2, 0, T, POLY, 0.25, 15, n=300)

# tracks (top copper shows through the coverlay as a lighter amber; bottom is hidden from the top view)
for t in b.GetTracks():
    if t.GetClass() == "PCB_TRACK" and t.GetLayer() == pcbnew.F_Cu:
        a, c = t.GetStart(), t.GetEnd()
        ax, ay, cx, cy = toMM(a.x) - X0, -(toMM(a.y) - Y0), toMM(c.x) - X0, -(toMM(c.y) - Y0)
        w = toMM(t.GetWidth())
        ln = math.hypot(cx - ax, cy - ay)
        if ln < 1e-4:
            continue
        m = pv.Box(bounds=(0, ln, -w / 2, w / 2, T, T + TC * 0.6), level=(max(1, int(ln / 0.3)), 1, 1)).triangulate()
        m.rotate_z(math.degrees(math.atan2(cy - ay, cx - ax)), inplace=True)
        m.translate((ax, ay, 0), inplace=True)
        items.append((m, COPPER, 0.5, 30))
    elif t.GetClass() == "PCB_VIA":
        p = t.GetPosition()
        x, y = toMM(p.x) - X0, -(toMM(p.y) - Y0)
        d = toMM(t.GetWidth())
        items.append((pv.Cylinder(center=(x, y, T + 0.006), direction=(0, 0, 1), radius=d / 2, height=0.012,
                                  resolution=16).triangulate(), COPPER, 0.5, 30))

# GND pour on top (filled polygons)
for z in b.Zones():
    if z.GetIsRuleArea() or z.GetLayer() != pcbnew.F_Cu:
        continue
    poly = z.GetFilledPolysList(pcbnew.F_Cu)
    for i in range(poly.OutlineCount()):
        o = poly.Outline(i)
        pts = np.array([[toMM(o.CPoint(k).x) - X0, -(toMM(o.CPoint(k).y) - Y0), T] for k in range(o.PointCount())])
        if len(pts) < 3:
            continue
        face = pv.PolyData(pts, faces=np.hstack([[len(pts)], np.arange(len(pts))])).triangulate()
        # holes are drawn as polyimide-coloured patches on top
        items.append((face.extrude((0, 0, TC * 0.5), capping=True).triangulate(), "#D98A3E", 0.35, 20))
        for hidx in range(poly.HoleCount(i)):
            hh = poly.Hole(i, hidx)
            hp = np.array([[toMM(hh.CPoint(k).x) - X0, -(toMM(hh.CPoint(k).y) - Y0), T + TC * 0.52] for k in range(hh.PointCount())])
            if len(hp) >= 3:
                items.append((pv.PolyData(hp, faces=np.hstack([[len(hp)], np.arange(len(hp))])).triangulate(), POLY, 0.26, 15))

# pads (gold, top side)
for fp in b.GetFootprints():
    if fp.IsFlipped():
        continue
    for pad in fp.Pads():
        bb = pad.GetBoundingBox()
        x0, x1 = toMM(bb.GetLeft()) - X0, toMM(bb.GetRight()) - X0
        y0, y1 = -(toMM(bb.GetBottom()) - Y0), -(toMM(bb.GetTop()) - Y0)
        if pad.GetShape() == pcbnew.PAD_SHAPE_CIRCLE:
            items.append((pv.Cylinder(center=((x0 + x1) / 2, (y0 + y1) / 2, T + TC * 0.6), direction=(0, 0, 1),
                                      radius=(x1 - x0) / 2, height=TC * 1.2, resolution=20).triangulate(), GOLD, 0.8, 60))
        else:
            box(x0, x1, y0, y1, T, T + TC * 1.2, GOLD, 0.8, 60)

# component bodies from the Fab outline, heights by package
H = {"U1": (0.5, "#1C2026"), "U2": (0.6, "#16181C"), "U3": (0.75, "#1A1A1D"), "U4": (0.7, "#1A1A1D"),
     "U5": (0.5, "#1C2026"), "Y1": (0.5, "#C9CDD1"), "AE1": (1.0, "#ECE7DB"), "L1": (0.8, "#4B4E54"),
     "D1": (0.55, "#F2EFE8"), "D2": (0.55, "#F2EFE8"), "D3": (0.6, "#22323E"), "J1": (0, None), "BT1": (0, None)}
for fp in b.GetFootprints():
    ref = fp.GetReference()
    if fp.IsFlipped() or ref.startswith("TP") or ref in ("J1", "BT1", "C9"):
        continue
    bb = None
    for g in fp.GraphicalItems():
        if g.GetLayer() == pcbnew.F_Fab and g.GetClass() == "FP_SHAPE":
            gb = g.GetBoundingBox()
            if bb is None:
                bb = gb
            else:
                bb.Merge(gb)
    if bb is None:
        bb = fp.GetBoundingBox(False, False)
    x0, x1 = toMM(bb.GetLeft()) - X0, toMM(bb.GetRight()) - X0
    y0, y1 = -(toMM(bb.GetBottom()) - Y0), -(toMM(bb.GetTop()) - Y0)
    if ref in H:
        hgt, col = H[ref]
    elif ref.startswith("C"):
        hgt, col = (0.5 if "0402" in fp.GetFPID().GetLibItemName().wx_str() else 0.3), "#B8976A"
    else:
        hgt, col = 0.3, "#2B2B2D"
    z0 = T + TC * 1.2 + (0.03 if ref[0] == "U" else 0)
    if ref[0] in "CRL" and ref != "L1" or ref in ("D1", "D2", "Y1", "L1"):
        # chip passives: body plus metal end caps
        horiz = (x1 - x0) >= (y1 - y0)
        box(x0, x1, y0, y1, z0, z0 + hgt, col, 0.3, 20)
        e = 0.18 * ((x1 - x0) if horiz else (y1 - y0))
        if ref[0] in "CRL" or ref == "L1":
            if horiz:
                box(x0 - 0.01, x0 + e, y0 - 0.01, y1 + 0.01, z0, z0 + hgt + 0.005, "#D9DBDE", 0.9, 70)
                box(x1 - e, x1 + 0.01, y0 - 0.01, y1 + 0.01, z0, z0 + hgt + 0.005, "#D9DBDE", 0.9, 70)
            else:
                box(x0 - 0.01, x1 + 0.01, y0 - 0.01, y0 + e, z0, z0 + hgt + 0.005, "#D9DBDE", 0.9, 70)
                box(x0 - 0.01, x1 + 0.01, y1 - e, y1 + 0.01, z0, z0 + hgt + 0.005, "#D9DBDE", 0.9, 70)
        if ref in ("D1", "D2"):
            items.append((pv.Cylinder(center=((x0 + x1) / 2, (y0 + y1) / 2, z0 + hgt + 0.02), direction=(0, 0, 1),
                                      radius=0.28, height=0.04, resolution=24).triangulate(),
                          "#D21F2B" if ref == "D1" else "#2C2338", 0.9, 80))
    else:
        box(x0, x1, y0, y1, z0, z0 + hgt, col, 0.6 if ref[0] == "U" else 0.3, 40)
        if ref == "D3":
            box(x0 + 0.3, x1 - 0.3, y0 + 0.3, y1 - 0.3, z0 + hgt, z0 + hgt + 0.01, "#3E5C70", 0.9, 90)
        if ref[0] == "U":
            t = pv.Text3D({"U1": "N52840", "U2": "86141", "U3": "T117", "U4": "2DW12", "U5": "BQ120A"}[ref],
                          depth=0.004, height=0.32).triangulate()
            tb = t.bounds
            t.translate(((x0 + x1) / 2 - (tb[0] + tb[1]) / 2, (y0 + y1) / 2 - (tb[2] + tb[3]) / 2, z0 + hgt), inplace=True)
            items.append((t, "#70747A", 0.1, 5))
            # pin-1 dot
            items.append((pv.Cylinder(center=(x0 + 0.25, y1 - 0.25, z0 + hgt + 0.002), direction=(0, 0, 1), radius=0.07,
                                      height=0.004, resolution=12).triangulate(), "#70747A", 0.1, 5))

# silkscreen text (board level)
for d in b.GetDrawings():
    if d.GetClass() == "PCB_TEXT" and d.GetLayer() == pcbnew.F_SilkS:
        p = d.GetPosition()
        hh = toMM(d.GetTextHeight())
        t = pv.Text3D(d.GetText(), depth=0.004, height=hh).triangulate()
        tb = t.bounds
        x, y = toMM(p.x) - X0, -(toMM(p.y) - Y0)
        dx = x - tb[0] if d.GetHorizJustify() == pcbnew.GR_TEXT_H_ALIGN_LEFT else x - (tb[0] + tb[1]) / 2
        t.translate((dx, y - (tb[2] + tb[3]) / 2, T + TC * 0.7), inplace=True)
        items.append((t, "#FAFAF6", 0.1, 5))


def plot(meshes, fname, cam, focal, size, angle=24, zoom=1.0, ground=None):
    pl = pv.Plotter(off_screen=True, window_size=size, lighting="none")
    pl.set_background("white")
    if ground is not None:
        pl.add_mesh(pv.Plane(center=(0, 0, ground), direction=(0, 0, 1), i_size=500, j_size=500),
                    color="#FBFBFA", ambient=0.55, diffuse=0.5, specular=0)
    for m, c, sp, spp in meshes:
        pl.add_mesh(m, color=c, smooth_shading=False, ambient=0.3, diffuse=0.72, specular=sp, specular_power=spp)
    for lt in (pv.Light(position=(cam[0] - 30, cam[1] - 20, cam[2] + 60), focal_point=focal, intensity=1.0, positional=True, cone_angle=70),
               pv.Light(position=(60, -30, 25), focal_point=focal, intensity=0.4),
               pv.Light(light_type="headlight", intensity=0.3)):
        pl.add_light(lt)
    try:
        pl.enable_shadows()
    except Exception:
        pass
    pl.camera.position = cam; pl.camera.focal_point = focal; pl.camera.up = (0, 0, 1)
    pl.camera.view_angle = angle; pl.camera.zoom(zoom)
    pl.enable_anti_aliasing("ssaa")
    pl.screenshot(os.path.join(OUT, fname))


# flat close-up of the electronics section, slight perspective
flat = [(m, c, s, p) for m, c, s, p in items]
plot(flat, "pcb3d_flat.png", (25.5, -16, 30), (25.5, 0.4, 0), (3200, 1400), angle=52, zoom=1.0, ground=-0.02)

# wrapped into the ring (parts face the finger)
R_FLEX, A0 = 11.6, 150.0


def wrap(m):
    m = m.copy()
    p = m.points
    phi = np.radians(A0) + p[:, 0] / R_FLEX
    r = R_FLEX + T - p[:, 2]
    m.points = np.c_[r * np.cos(phi), r * np.sin(phi), -p[:, 1]]
    return m


def upright(m, c):
    """Printed text reads upright on the inner face: turn it 180 deg in the board plane before wrapping."""
    if c not in ("#70747A", "#FAFAF6"):
        return m
    m = m.copy(); bnd = m.bounds
    cx, cy = (bnd[0] + bnd[1]) / 2, (bnd[2] + bnd[3]) / 2
    m.points[:, 0] = 2 * cx - m.points[:, 0]; m.points[:, 1] = 2 * cy - m.points[:, 1]
    return m


# pour polygons are large flat faces that would chord across the ring when wrapped: leave them out of this view
ring = [(wrap(upright(m, c)), c, s, p) for m, c, s, p in items if not (c == "#D98A3E" or (c == POLY and s == 0.26))]
plot(ring, "pcb3d_ring.png", (16, 50, 36), (0, 0, -1), (2000, 1600), angle=30, zoom=1.0, ground=-3.02)
print("renders written to", OUT)
